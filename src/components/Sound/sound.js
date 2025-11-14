import React, { useState, useEffect } from 'react';
import HearingOutlinedIcon from '@mui/icons-material/HearingOutlined';
import Button from '@mui/material/Button';
import Modal from '@mui/material/Modal';
import TextField from '@mui/material/TextField';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import DropSound from './DropSound';
import axios from 'axios';
import useXttribute from '../Xttribute/useXttribute';
import { API_BASE_URL, objDBName,CDNURL } from '../../constants/apiConstants';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import CheckIcon from '@mui/icons-material/Check';
import InputAdornment from '@mui/material/InputAdornment';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';

function Sound(props) {
    let isEdit = false;
    if (props && props.editable == "t") isEdit = true;

    // new state for modal and upload handling
    const { xid } = useXttribute();
    const [isModalOpen, setIsModalOpen] = useState(false);
    // persist a placeholder sound record on modal open and keep its id here
    const [soundID, setSoundID] = useState(null);
    const [uploaded, setUploaded] = useState(false);
    const [title, setTitle] = useState('');
    const [modalMessage, setModalMessage] = useState(null);
    // track whether the title textfield is in edit mode (focused)
    const [isEditingTitle, setIsEditingTitle] = useState(false);

    // mini track player state
    const [uploadedSoundSrc, setUploadedSoundSrc] = useState(null);
    // separate refs for main UI audio and modal audio to avoid clobbering
    const audioRefMain = React.useRef(null);
    const audioRefModal = React.useRef(null);
    const [createdObjectUrl, setCreatedObjectUrl] = useState(null);
    // track which record id is currently playing in the list (null = none)
    const [playingId, setPlayingId] = useState(null);
    // separate flag for the modal/main preview player to avoid conflicts with the list
    const [isPlayingModal, setIsPlayingModal] = useState(false);
    // modal preview time/duration (keeps previous behavior for the modal)
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    // per-record time/duration maps (recordId -> seconds)
    const [currentTimes, setCurrentTimes] = useState({});
    const [durationsMap, setDurationsMap] = useState({});
	const pageSize = 8; 
    // New: store fetched sound records list and pagination state
    const [records, setRecords] = useState([]);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [loading, setLoading] = useState(false);
    // refs to avoid duplicate fetches
    const fetchInFlightRef = React.useRef(new Set());
    // Map of audio element refs keyed by record id
    const audioRefs = React.useRef(new Map());
    // sentinel for IntersectionObserver infinite scroll
    const sentinelRef = React.useRef(null);
    // Only auto-load additional pages after the user has interacted (scroll/wheel/touch).
    // Prevents auto-fetching multiple pages on initial navigation when the list is short.
    const userInteractedRef = React.useRef(false);
    const [userInteracted, setUserInteracted] = useState(false);

    // Attach one-time listeners to detect user interaction and enable auto-loading.
    useEffect(() => {
      if (userInteracted) return undefined;
      // only consider explicit user input events (wheel/touchstart). Do NOT use 'scroll' here
      // because some environments fire synthetic scroll on initial render which would enable auto-loading.
      const onUserInteract = () => {
        userInteractedRef.current = true;
        try { setUserInteracted(true); } catch (e) {}
        window.removeEventListener('wheel', onUserInteract);
        window.removeEventListener('touchstart', onUserInteract);
      };
      window.addEventListener('wheel', onUserInteract, { passive: true });
      window.addEventListener('touchstart', onUserInteract, { passive: true });
      return () => {
        try { window.removeEventListener('wheel', onUserInteract); window.removeEventListener('touchstart', onUserInteract); } catch (e) {}
      };
    }, [userInteracted]);

    // New: inline edit state for list item titles
    const [editingRecordId, setEditingRecordId] = useState(null);
    const [editingRecordTitle, setEditingRecordTitle] = useState('');
    // Prevent duplicate concurrent saves for inline edits
    const editingSavingRef = React.useRef(false);

    // Debug flag: enable by adding ?debugSound=1 to the URL
    const debugSound = React.useMemo(() => {
      try { return typeof window !== 'undefined' && (new URLSearchParams(window.location.search)).get('debugSound') === '1'; } catch (e) { return false; }
    }, []);

    // New: pending delete state to avoid window.confirm modal
    const [pendingDeleteId, setPendingDeleteId] = useState(null);
    const [deletingId, setDeletingId] = useState(null);

    // When uploadedSoundSrc changes, make sure any audio element loads it.
    useEffect(() => {
      if (!uploadedSoundSrc) {
        return undefined;
      }
      try {
        // load preview into both main and modal audio elements but only start modal/main preview (not list items)
        [audioRefMain.current, audioRefModal.current].forEach(a => {
          if (a) {
            if (a.src !== uploadedSoundSrc) a.src = uploadedSoundSrc;
            a.load();
          }
        });
        // play modal preview if available
        if (audioRefModal.current) {
          audioRefModal.current.play().then(() => setIsPlayingModal(true)).catch(()=>{});
        }
      } catch (err) {
        console.warn('Error loading audio preview', err);
      }
      return undefined;
    }, [uploadedSoundSrc]);

    // Revoke any created object URL when it changes or on unmount
    useEffect(() => {
      return () => {
        if (createdObjectUrl) {
          try { URL.revokeObjectURL(createdObjectUrl); } catch (e) {}
        }
      };
    }, [createdObjectUrl]);

    // Paginated fetch for sound records. Can request any page; append when needed.
    const fetchSounds = async (requestedPage = 1, append = false) => {
      console.debug('[Sound] fetchSounds called', { requestedPage, append, xid });
       if (!xid) return;
      if (!fetchInFlightRef.current) fetchInFlightRef.current = new Set();
      if (fetchInFlightRef.current.has(requestedPage)) return;
      fetchInFlightRef.current.add(requestedPage);
      if (requestedPage === 1) setHasMore(true);
      if (!hasMore && requestedPage !== 1) {
        fetchInFlightRef.current.delete(requestedPage);
        return;
      }
      setLoading(true);
      try {
        const payload = {
          dbName: objDBName,
          collName: 'sound',
		  docContents: "{'xid':'" +xid + "'}",
		  operator : "none",
		  returnType: "list",
		  sortBy: "_id",
		  order: "DESC",
		  limit: pageSize
        };
        const res = await axios.post(API_BASE_URL + `/getObjects?page=${requestedPage}`, payload);
        if (res && res.status === 200 && res.data) {
          const arr = Array.isArray(res.data) ? res.data : (res.data.objects || res.data.docs || []);
          if (append) {
            setRecords(prev => {
              const existingIds = new Set((prev || []).map(r => String(r._id)));
              const newOnes = (arr || []).filter(o => !existingIds.has(String(o._id)));
              return [...(prev || []), ...newOnes];
            });
            setPage(requestedPage);
          } else {
            setRecords(arr || []);
            setPage(1);
          }
          if (!arr || arr.length < pageSize) setHasMore(false); else setHasMore(true);
        }
      } catch (err) {
        console.warn('[Sound] fetchSounds error', err);
      } finally {
        setLoading(false);
        try { fetchInFlightRef.current.delete(requestedPage); } catch(e){}
      }
    };

    // Initial load
    useEffect(() => {
      if (!xid) return;
      fetchSounds(1, false);
    }, [xid]);

    const handleLoadMore = () => {
      console.debug('[Sound] handleLoadMore called', { page, loading, hasMore });
      if (!hasMore) return;
      // If any fetch is in flight, avoid starting another page to prevent multiple simultaneous page loads
      if (loading) return;
      if (fetchInFlightRef.current && fetchInFlightRef.current.size > 0) return;
      const next = page + 1;
      if (fetchInFlightRef.current && fetchInFlightRef.current.has(next)) return;
      fetchSounds(next, true).catch(()=>{});
     };

    // Only create IntersectionObserver after user has interacted
    React.useEffect(() => {
      // do not attach observer until user interacts; keeps initial load to page 1
      if (!userInteracted) return undefined;
      const el = sentinelRef.current;
      if (!el) return undefined;
      if (!hasMore) return undefined;
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            console.debug('[Sound] IntersectionObserver triggered load');
            handleLoadMore();
          }
        });
      }, {
        root: null,
        rootMargin: '100px',
        threshold: 0
      });
      observer.observe(el);
      return () => {
        try { observer.unobserve(el); } catch (e) {}
      };
    }, [loading, hasMore, page, xid, userInteracted]);

    // Window scroll fallback: if IntersectionObserver doesn't fire, this will still trigger loads.
    React.useEffect(() => {
      // only attach fallback after user interaction
      if (!userInteracted) return undefined;
      let timer = null;
      const onScroll = () => {
        if (!sentinelRef.current) return;
        if (timer) return;
        timer = setTimeout(() => {
          timer = null;
          if (loading || !hasMore) return;
          // userInteracted already required by effect
            try {
              const rect = sentinelRef.current.getBoundingClientRect();
              const threshold = 300; // px
              if (rect.top <= (window.innerHeight + threshold)) {
                console.debug('[Sound] window scroll fallback triggered load');
                handleLoadMore();
              }
            } catch (e) {}
         }, 150);
       };
       window.addEventListener('scroll', onScroll, { passive: true });
       return () => { window.removeEventListener('scroll', onScroll); if (timer) clearTimeout(timer); };
     }, [loading, hasMore, page, xid, userInteracted]);

    // open modal and create placeholder record so DropSound can attach to it
    const handleOpen = async () => {
        // Reset state first
        setSoundID(null);
        setUploaded(false);
        setModalMessage(null);
        setUploadedSoundSrc(null);
        setIsPlayingModal(false);
        setCurrentTime(0);
        setDuration(0);
        setIsEditingTitle(false);

        // Create placeholder record first, then open modal so DropSound receives compId immediately
        if (!xid) {
            setIsModalOpen(true);
            return;
        }

        try {
            const payload = {
                "dbName": objDBName,
                "collName": "sound",
                "docContents": "{'xid':'" + xid + "'}",
                "uKey": "0"
            };
            const response = await axios.post(API_BASE_URL + '/newObject', payload);
            // store returned id for later use even if doc_201 message is not present
            if (response && response.status === 200) {
                let returnedId = response.data && (response.data._id || response.data.insertedId || response.data.compId);
                // normalize empty-string -> null
                if (typeof returnedId === 'string') returnedId = returnedId.trim() || null;
                console.debug('[Sound] newObject returned id:', returnedId, response.data);
                setSoundID(returnedId || null);
            }
        } catch (err) {
            console.error('[Sound] error creating placeholder sound record', err);
            setModalMessage('Failed to create placeholder record');
        }

        // Open modal after attempting to create the record
        setIsModalOpen(true);
    };

    // close modal; if placeholder was created and no upload happened, remove it
    const handleClose = async () => {
        try {
            if (soundID && !uploaded) {
                const payload = {
                    "dbName": objDBName,
                    "collName": "sound",
                    "docContents": "{'_id':'" + soundID + "'}",
                    "uKey": "_id"
                };
                await axios.post(API_BASE_URL + '/removeObject', payload);
            }
        } catch (err) {
            console.log('[Sound] failed to cleanup created record on close', err);
        }
        setIsModalOpen(false);
        setSoundID(null);
        setTitle('');
        setUploaded(false);
        setModalMessage(null);
        setUploadedSoundSrc(null);
        setIsPlayingModal(false);
        setCurrentTime(0);
        setDuration(0);
        setIsEditingTitle(false);

        // Reload the sound records so the list reflects any newly uploaded or removed items
        try {
          await fetchSounds(1, false);
        } catch (e) {
          // ignore fetch errors here but log for debugging
          console.warn('[Sound] failed to refresh list after modal close', e);
        }
    };

    // Called by DropSound when upload succeeds
    const handleUploadSuccess = (uploadResponse) => {
        console.log('[Sound] uploadResponse=', uploadResponse);
        setUploaded(true);
        setModalMessage('Sound uploaded');
        setTimeout(() => setModalMessage(null), 3000);

        // normalize possible shapes: either server response OR { response, file }
        if (!uploadResponse) return;

        // if callback included a direct soundUrl (DropSound now provides it), prefer it
        if (uploadResponse.soundUrl) {
          const provided = uploadResponse.soundUrl;
          setUploaded(true);
          setUploadedSoundSrc(provided);
          setCurrentTime(0);
          setDuration(0);
          setIsPlayingModal(false);
          // if there's a server response with id, update it
          const srv = uploadResponse.response || null;
          const possibleIdDirect = srv && (srv._id || srv.compId || srv.insertedId);
          if (possibleIdDirect) setSoundID(possibleIdDirect);
          return;
        }

        // handle wrapper { response, file } or direct server response
        const server = (uploadResponse && uploadResponse.response) ? uploadResponse.response : uploadResponse;

        // if server returned an id, update it
        const possibleId = server && (server._id || server.compId || server.insertedId);
        if (possibleId) setSoundID(possibleId);

        // Prefer server-provided 'sound' field for the player source (do NOT use local blob). Only fall back to other server fields.
        let src = null;
        if (server) {
          const d = server;
          if (d.sound) src = d.sound;
          else if (typeof d === 'string') src = d;
          else if (d.fileUrl) src = d.fileUrl;
          else if (d.url) src = d.url;
          else if (d.path) src = d.path;
          else if (d.file_path) src = d.file_path;
          else if (d.file && typeof d.file === 'string') src = d.file;
          else if (d.files && Array.isArray(d.files) && d.files[0]) {
            src = d.files[0].sound || d.files[0].url || d.files[0].path || d.files[0].file;
          }
        }

        if (src) {
          // build absolute URL using CDNURL when available, fallback to API_BASE_URL
          if (!src.startsWith('http')) {
            const base = (typeof CDNURL === 'string' && CDNURL) ? CDNURL : API_BASE_URL;
            src = src.startsWith('/') ? base + src : base  + src;
          }
          setUploadedSoundSrc(src);
          // reset player time/duration
          setCurrentTime(0);
          setDuration(0);
          setIsPlayingModal(false);
          // audio element will be loaded by useEffect watching uploadedSoundSrc
        } else {
          console.warn('No server sound URL found in upload response; player will keep local preview if present. Response:', uploadResponse);
        }
    };

    // toggle play for modal/main preview (separate from list players)
    const togglePreviewPlay = (whichRef) => {
      const audio = whichRef && whichRef.current ? whichRef.current : null;
      if (!audio) return;
      if (audio.paused) {
        audio.play().catch(()=>{});
        setIsPlayingModal(true);
      } else {
        audio.pause();
        setIsPlayingModal(false);
      }
    };

    // player control helpers - accept a ref to target a specific audio element
    const togglePlay = (whichRef) => {
      const audio = whichRef && whichRef.current ? whichRef.current : null;
      if (!audio) return;
      if (audio.paused) {
        audio.play().catch(()=>{});
        setIsPlayingModal(true);
      } else {
        audio.pause();
        setIsPlayingModal(false);
      }
    };

    // use event-based handlers so they work for either audio element
    const onTimeUpdate = (e) => {
      const audio = e && e.target ? e.target : null;
      if (!audio) return;
      // if this is the modal/main preview audio element, update modal state
      if (audio === audioRefModal.current || audio === audioRefMain.current) {
        setCurrentTime(audio.currentTime);
        return;
      }
      // otherwise, use data-record-id to update per-record time
      const rid = audio.dataset && audio.dataset.recordId ? audio.dataset.recordId : null;
      if (rid) {
        setCurrentTimes(prev => ({ ...(prev || {}), [rid]: audio.currentTime }));
      }
    };

    const onLoadedMetadata = (e) => {
      const audio = e && e.target ? e.target : null;
      if (!audio) return;
      if (audio === audioRefModal.current || audio === audioRefMain.current) {
        setDuration(audio.duration || 0);
        return;
      }
      const rid = audio.dataset && audio.dataset.recordId ? audio.dataset.recordId : null;
      if (rid) {
        setDurationsMap(prev => ({ ...(prev || {}), [rid]: audio.duration || 0 }));
      }
    };

    // seek handler for modal/main preview audio
    const onSeek = (e) => {
      const val = Number(e.target.value || 0);
      const audio = (isModalOpen ? audioRefModal.current : audioRefMain.current) || audioRefMain.current || audioRefModal.current;
      if (!audio) return;
      try { audio.currentTime = val; } catch (err) {}
      setCurrentTime(val);
    };

    // seek handler for a specific record's audio element
    const onSeekRecord = (e, rid) => {
      const val = Number(e.target.value || 0);
      const a = audioRefs.current.get(String(rid));
      if (!a) return;
      try { a.currentTime = val; } catch (err) {}
      setCurrentTimes(prev => ({ ...(prev || {}), [rid]: val }));
    };

    // send title update to backend
    const handleTitleConfirm = async () => {
      if (!soundID) {
        setModalMessage('No sound record to update');
        setTimeout(() => setModalMessage(null), 3000);
        return;
      }
      const trimmed = (title || '').trim();
      if (!trimmed) {
        setModalMessage('Title cannot be empty');
        setTimeout(() => setModalMessage(null), 3000);
        return;
      }

      // escape single quotes in title to avoid breaking the server's simple string format
      const safeTitle = trimmed.replace(/'/g, "\\'");

      const payload = {
        dbName: objDBName,
        collName: 'sound',
        docContents: "{'_id':'" + soundID + "','title':'" + safeTitle + "'}",
        uKey: '_id',
		updateKey: 'title'
      };

      try {
        const res = await axios.post(API_BASE_URL + '/editObject', payload);
        if (res && (res.status === 200 || res.status === 204)) {
          setModalMessage('Title updated');
          setIsEditingTitle(false);
          setTimeout(() => setModalMessage(null), 3000);

          // update displayed records list if present
          setRecords(prev => {
            if (!prev) return prev;
            return prev.map(r => {
              if (String(r._id) === String(soundID)) {
                return { ...r, title: trimmed };
              }
              return r;
            });
          });
        } else {
          console.warn('[Sound] editObject unexpected response', res);
          setModalMessage('Failed to update title');
          setTimeout(() => setModalMessage(null), 3000);
        }
      } catch (err) {
        console.error('[Sound] failed to update title', err);
        setModalMessage('Failed to update title');
        setTimeout(() => setModalMessage(null), 3000);
      }
    };

    // Start editing a record's title inline in the list
    const startEditRecord = (rec) => {
      const id = rec && (rec._id || rec.compId || rec.insertedId);
      if (!id) return;
      setEditingRecordId(String(id));
      setEditingRecordTitle(rec.title || '');
    };
    
    const cancelEditRecord = () => {
      setEditingRecordId(null);
      setEditingRecordTitle('');
    };
    
    // Confirm inline title edit for a record in the list
    const confirmEditRecord = async (recId) => {
      if (editingSavingRef.current) return;
      const trimmed = (editingRecordTitle || '').trim();
      if (!recId) return;
      if (!trimmed) {
        // Do not allow empty titles
        return;
      }
      editingSavingRef.current = true;
      const safeTitle = trimmed.replace(/'/g, "\\'");
      const payload = {
        dbName: objDBName,
        collName: 'sound',
        docContents: "{'_id':'" + recId + "','title':'" + safeTitle + "'}",
        uKey: '_id',
        updateKey: 'title'
      };
      try {
        const res = await axios.post(API_BASE_URL + '/editObject', payload);
        if (res && (res.status === 200 || res.status === 204)) {
          // update local list
          setRecords(prev => (prev || []).map(r => {
            if (String(r._id || r.compId || r.insertedId) === String(recId)) {
              return { ...r, title: trimmed };
            }
            return r;
          }));
          cancelEditRecord();
        } else {
          console.warn('[Sound] editObject unexpected response', res);
        }
      } catch (err) {
        console.error('[Sound] failed to update title (inline)', err);
      } finally {
        editingSavingRef.current = false;
      }
    };

    // Request deletion for a record - shows inline confirmation. Does NOT call backend immediately.
    const removeRecord = (rec) => {
      const id = rec && (rec._id || rec.compId || rec.insertedId);
      if (!id) return;
      setPendingDeleteId(String(id));
    };

    const cancelDelete = () => {
      setPendingDeleteId(null);
    };

    // perform actual deletion after inline confirmation
    const performDelete = async (rec) => {
      const id = rec && (rec._id || rec.compId || rec.insertedId);
      if (!id) return;
      const key = String(id);
      setDeletingId(key);
      const payload = {
        dbName: objDBName,
        collName: 'sound',
        docContents: "{'_id':'" + key + "'}",
        uKey: '_id'
      };
      try {
        const res = await axios.post(API_BASE_URL + '/removeObject', payload);
        if (res && (res.status === 200 || res.status === 204)) {
          // stop and cleanup audio element if present
          try {
            const a = audioRefs.current.get(key);
            if (a) { a.pause(); audioRefs.current.delete(key); }
          } catch (e) {}
          // remove from records
          setRecords(prev => (prev || []).filter(r => String(r._id || r.compId || r.insertedId) !== key));
          if (playingId === key) setPlayingId(null);
        } else {
          console.warn('[Sound] removeObject unexpected response', res);
        }
      } catch (err) {
        console.error('[Sound] failed to remove record', err);
      } finally {
        setDeletingId(null);
        setPendingDeleteId(null);
      }
    };

    return (
        <div style={{ padding: 16 }}>
            {isEdit && (
                <div className="addButton">
                    <Button className="button-8 add-button-plain" endIcon={<HearingOutlinedIcon fontSize="small" />} onClick={handleOpen} variant="text" disableElevation disableRipple>
                        + Sound
                    </Button>
                </div>
            )}
        
            {/* Render paginated list of sound records */}
            <div style={{ marginTop: 12 }}>
              {records && records.length > 0 ? (
                (() => {
                  // group records by date from MongoDB ObjectId timestamp (YYYY-MM-DD)
                  const grouped = {};
                  (records || []).forEach((rec) => {
                    const id = rec._id || rec.compId || rec.insertedId;
                    const dateKey = dateKeyFromId(String(id));
                    if (!grouped[dateKey]) grouped[dateKey] = [];
                    grouped[dateKey].push(rec);
                  });
                  // sort date groups descending (newest first)
                  const dateKeys = Object.keys(grouped).sort((a, b) => b.localeCompare(a));
                  return dateKeys.map((dk) => (
                    <div key={dk} style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 13, margin: '8px 0', textAlign: 'center' }}>{formatDateHeader(dk)}</div>
                      {grouped[dk].map((rec) => {
                        const id = rec._id || rec.compId || rec.insertedId;
                        const srcCandidate = rec.sound || rec.fileUrl || rec.url || rec.path || rec.file || null;
                        let src = srcCandidate;
                        if (src && !src.startsWith('http')) {
                          const base = (typeof CDNURL === 'string' && CDNURL) ? CDNURL : API_BASE_URL;
                          src = src.startsWith('/') ? base + src : base + src;
                        }
                        return (
                          <div key={String(id)} style={{ padding: 8, borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', gap: 12 }}>
                            <IconButton
                              onClick={() => {
                                // toggle the record's audio element by id. Pause all others first.
                                const key = String(id);
                                let a = audioRefs.current.get(key);
                                if (!a) return;
                                // If currently playing this id, pause it
                                if (playingId === key && !a.paused) {
                                  a.pause();
                                  setPlayingId(null);
                                  return;
                                }
                                // Pause all other audios
                                audioRefs.current.forEach((el, k) => { try { if (el && el !== a) { el.pause(); el.currentTime = 0; } } catch(e){} });
                                // ensure this element has the correct src
                                if (a.src !== src) a.src = src || undefined;
                                a.play().then(() => setPlayingId(key)).catch(()=>{});
                              }}
                              aria-label="Play"
                              size="small"
                              disabled={!src}
                            >
                              {playingId === String(id) ? <PauseIcon /> : <PlayArrowIcon />}
                            </IconButton>
                            <div style={{ flex: 1 }}>
                              {/* Inline editable title */}
                              {editingRecordId === String(id) ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <TextField
                                    value={editingRecordTitle}
                                    onChange={(e) => setEditingRecordTitle(e.target.value)}
                                    // confirm on blur (clicking outside saves; empty -> cancel)
                                    onBlur={() => {
                                      const trimmed = (editingRecordTitle || '').trim();
                                      if (!trimmed) { cancelEditRecord(); return; }
                                      confirmEditRecord(String(id));
                                    }}
                                    size="small"
                                    autoFocus
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') { confirmEditRecord(String(id)); }
                                      if (e.key === 'Escape') { cancelEditRecord(); }
                                    }}
                                    InputProps={{
                                      endAdornment: (
                                        <InputAdornment position="end">
                                          <IconButton
                                            aria-label="confirm title"
                                            onMouseDown={(e) => e.preventDefault()}
                                            onClick={() => confirmEditRecord(String(id))}
                                            disabled={(editingRecordTitle || '').trim() === ''}
                                            size="large"
                                          >
                                            <CheckIcon />
                                          </IconButton>
                                        </InputAdornment>
                                      )
                                    }}
                                    sx={{ width: '100%' }}
                                  />
                                </div>
                              ) : (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                  <div style={{ fontSize: 14, fontWeight: 500, cursor: 'text' }} onClick={() => startEditRecord(rec)}>{rec.title || '(untitled)'}</div>
                                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                    <IconButton aria-label="edit title" size="small" onClick={() => startEditRecord(rec)}>
                                      <EditIcon fontSize="small" />
                                    </IconButton>
                                    {/* Inline confirmation UI instead of window.confirm modal */}
                                    {pendingDeleteId === String(id) ? (
                                      <div style={{ display: 'flex', gap: 6 }}>
                                        <Button
                                          variant="contained"
                                          color="error"
                                          size="small"
                                          onClick={() => performDelete(rec)}
                                          disabled={deletingId === String(id)}
                                        >
                                          {deletingId === String(id) ? 'Deleting...' : 'Delete'}
                                        </Button>
                                        <Button variant="text" size="small" onClick={cancelDelete}>Cancel</Button>
                                      </div>
                                    ) : (
                                      <IconButton aria-label="delete" size="small" onClick={() => removeRecord(rec)}>
                                        <DeleteIcon fontSize="small" />
                                      </IconButton>
                                    )}
                                   </div>
                                 </div>
                              )}
                               {/* no per-record date shown here; group header displays the date */}
                              {/* per-record progress and time */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <input
                                  type="range"
                                  min={0}
                                  max={Math.max(durationsMap[String(id)] || 0, 0)}
                                  step={0.01}
                                  value={currentTimes[String(id)] || 0}
                                  onChange={(e) => onSeekRecord(e, String(id))}
                                  style={{ flex: 1 }}
                                  disabled={!audioRefs.current.get(String(id))}
                                />
                                <div style={{ fontSize: 12, color: '#444', minWidth: 80, textAlign: 'right' }}>
                                  <span>{formatTime(currentTimes[String(id)] || 0)}</span>
                                  <span style={{ color: '#888' }}> / </span>
                                  <span>{formatTime(durationsMap[String(id)] || 0)}</span>
                                </div>
                              </div>
                            </div>
                            <audio
                              data-record-id={String(id)}
                              ref={(el) => { if (el && String(id)) audioRefs.current.set(String(id), el); }}
                              src={src || undefined}
                              onTimeUpdate={onTimeUpdate}
                              onLoadedMetadata={onLoadedMetadata}
                              onPlay={() => setPlayingId(String(id))}
                              onPause={() => { if (playingId === String(id)) setPlayingId(null); }}
                              style={{ display: 'none' }}
                            />
                          </div>
                        );
                      })}
                    </div>
                  ));
                })()
              ) : (
                <p style={{ marginTop: 12, color: '#555' }}>{loading ? 'Loading sounds...' : 'No sounds yet — placeholder component.'}</p>
              )}
              {hasMore && !loading && (
                <div style={{ textAlign: 'center', marginTop: 8 }}>
                  {/* sentinel observed by IntersectionObserver to auto-load next page */}
                  <div ref={sentinelRef} style={{ width: '100%', height: 20 }} aria-hidden="true" />
                  <div style={{ fontSize: 13, color: '#666', marginTop: 6 }}>Scroll to load more</div>
                </div>
              )}
              {debugSound && (
                <div style={{ marginTop: 8, padding: 8, border: '1px dashed #ccc', borderRadius: 6, fontSize: 13 }}>
                  <div style={{ marginBottom: 6 }}><strong>Debug</strong> — page: {page}, loading: {String(loading)}, hasMore: {String(hasMore)}, records: {records.length}</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Button size="small" variant="outlined" onClick={() => { handleLoadMore(); }}>Load more (debug)</Button>
                    <Button size="small" variant="text" onClick={() => { console.debug('[Sound] state', { page, loading, hasMore, recordsLength: records.length, sentinelExists: !!sentinelRef.current }); }}>Log state</Button>
                  </div>
                </div>
              )}
              {loading && <div style={{ textAlign: 'center', marginTop: 8 }}>Loading...</div>}
            </div>

             {/* Modal for adding/uploading a sound */}
             <Modal
                 open={isModalOpen}
                 onClose={handleClose}
                 aria-labelledby="add-sound-modal"
                 aria-describedby="upload-sound"
             >
                 <Box sx={{
                     position: 'absolute',
                     top: '50%',
                     left: '50%',
                     transform: 'translate(-50%, -50%)',
                     width: 600,
                     bgcolor: 'background.paper',
                     border: '1px solid #ccc',
                     boxShadow: 24,
                     p: 4,
                     borderRadius: 2,
                 }}>
                     <IconButton
                         aria-label="close"
                         onClick={handleClose}
                         sx={{ position: 'absolute', right: 8, top: 8 }}
                     >
                         <CloseIcon />
                     </IconButton>
                     {/* Header: + Sound with icon similar to the Photo modal */}
                     <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                       <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                         <HearingOutlinedIcon fontSize="small" />
                         <strong style={{ fontSize: 18 }}>+ Sound</strong>
                       </div>
                     </div>
                     <TextField
                         fullWidth
                         label="Sound title"
                         value={title}
                         onChange={(e) => setTitle(e.target.value)}
                         onFocus={() => setIsEditingTitle(true)}
                         onBlur={() => setIsEditingTitle(false)}
                         margin="normal"
                         InputProps={{
                           // Only show the check adornment while the user is actively editing the title
                           endAdornment: (
                             isEditingTitle ? (
                               <InputAdornment position="end">
                                 <IconButton
                                   aria-label="confirm title"
                                   onMouseDown={(e) => e.preventDefault()} // prevent blur before click
                                   onClick={handleTitleConfirm}
                                   disabled={!soundID || (title || '').trim() === ''}
                                   size="large"
                                 >
                                   <CheckIcon />
                                 </IconButton>
                               </InputAdornment>
                             ) : null
                           )
                         }}
                     />

                     {/* mini track player - always visible when modal open; disabled until a source is loaded */}
                     <div style={{ marginBottom: 12, padding: 8, border: '1px solid #eee', borderRadius: 6 }}>
                       <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                         <IconButton onClick={() => togglePreviewPlay(audioRefModal)} aria-label={isPlayingModal ? 'Pause' : 'Play'} disabled={!uploadedSoundSrc}>
                           {isPlayingModal ? <PauseIcon /> : <PlayArrowIcon />}
                         </IconButton>
                         <div style={{ flex: 1 }}>
                           <input
                             type="range"
                             min={0}
                             max={Math.max(duration, 0)}
                             step={0.01}
                             value={currentTime}
                             onChange={onSeek}
                             style={{ width: '100%' }}
                             disabled={!uploadedSoundSrc}
                           />
                           <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#444' }}>
                             <div>{uploadedSoundSrc ? formatTime(currentTime) : '--:--'}</div>
                             <div>{uploadedSoundSrc ? formatTime(duration) : '--:--'}</div>
                           </div>
                         </div>
                       </div>
                       {!uploadedSoundSrc && (
                         <div style={{ marginTop: 8, fontSize: 13, color: '#666' }}>No track loaded — drop a sound below to preview.</div>
                       )}
                       <audio
                         ref={audioRefModal}
                         src={uploadedSoundSrc || undefined}
                         onTimeUpdate={onTimeUpdate}
                         onLoadedMetadata={onLoadedMetadata}
                         onPlay={() => setIsPlayingModal(true)}
                         onPause={() => setIsPlayingModal(false)}
                         style={{ display: 'none' }}
                       />
                     </div>

                     {/* DropSound handles the drag-and-drop upload; pass createdId as compId so it can associate the file */}
                     {typeof DropSound === 'function' ? (
                         // Constrain the drop area height and mark as presentation for accessibility
                         <div role="presentation" style={{ maxHeight: 200, height: 100, overflow: 'auto', padding: 4 }}>
                             <DropSound
                                 type="sound"
                                 folder="sound"
                                 dbName={objDBName}
                                 collName="sound"
                                 compId={soundID}
                                 handleError={(err) => setModalMessage(err)}
                                 onSoundUploaded={handleUploadSuccess}
                                 previewHeight="120px"
                             />
                         </div>
                     ) : (
                         <div style={{ color: 'red', padding: 8 }}>
                             Error: DropSound component is not available. Check import/export.
                         </div>
                     )}
                     {modalMessage && <div style={{ marginTop: 12, color: '#0a0' }}>{modalMessage}</div>}
                 </Box>
             </Modal>
         </div>
     );
 }

 // helper to format seconds -> mm:ss
 function formatTime(sec) {
   if (!sec && sec !== 0) return '--:--';
   const s = Math.floor(sec || 0);
   const mm = Math.floor(s / 60);
   const ss = s % 60;
   return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
 }

 // helper to extract date key from MongoDB ObjectId (YYYY-MM-DD)
 function dateKeyFromId(id) {
   if (!id || typeof id !== 'string' || id.length < 24) return null;
   // ObjectId timestamp is in the first 8 characters (32-bit hex int, seconds since epoch)
   const timestampHex = id.substring(0, 8);
   const timestamp = parseInt(timestampHex, 16) * 1000; // convert to milliseconds
   const date = new Date(timestamp);
   // format as YYYY-MM-DD
   return date.toISOString().substring(0, 10);
 }

 // helper to format date header from YYYY-MM-DD to readable string
 function formatDateHeader(dateKey) {
   if (!dateKey || typeof dateKey !== 'string' || dateKey.length !== 10) return dateKey;
   const parts = dateKey.split('-');
   if (parts.length !== 3) return dateKey;
   const [year, month, day] = parts;
   return `${month}/${day}/${year}`;
 }

 export default Sound;
