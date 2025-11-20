import React, { useState, useEffect } from 'react';
import VideocamOutlinedIcon from '@mui/icons-material/VideocamOutlined';
import Button from '@mui/material/Button';
import Modal from '@mui/material/Modal';
import TextField from '@mui/material/TextField';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import DropVideo from './DropVideo';
import axios from 'axios';
import useXttribute from '../Xttribute/useXttribute';
import { API_BASE_URL, objDBName,CDNURL } from '../../constants/apiConstants';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import CheckIcon from '@mui/icons-material/Check';
import InputAdornment from '@mui/material/InputAdornment';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';

function Video(props) {
    let isEdit = false;
    if (props && props.editable == "t") isEdit = true;

    // new state for modal and upload handling
    const { xid } = useXttribute();
    const [isModalOpen, setIsModalOpen] = useState(false);
    // persist a placeholder video record on modal open and keep its id here
    const [videoID, setVideoID] = useState(null);
    const [uploaded, setUploaded] = useState(false);
    const [title, setTitle] = useState('');
    const [modalMessage, setModalMessage] = useState(null);
    // track whether the title textfield is in edit mode (focused)
    const [isEditingTitle, setIsEditingTitle] = useState(false);

    // mini track player state
    const [uploadedVideoSrc, setUploadedVideoSrc] = useState(null);
    // generated thumbnail data URL for modal preview (single, kept for compatibility)
    const [thumbnailSrc, setThumbnailSrc] = useState(null);
    // multiple generated thumbnails (array of data URLs)
    const [thumbnailSrcs, setThumbnailSrcs] = useState([]);
    // modal thumbnail upload state
    const [isThumbUploadingModal, setIsThumbUploadingModal] = useState(false);
    const [thumbUploadProgressModal, setThumbUploadProgressModal] = useState(null);
    // index of selected thumbnail in the modal (null = none)
    const [selectedThumbIndex, setSelectedThumbIndex] = useState(null);
    // index of confirmed/uploaded thumbnail (null = none) — used to change button to "Selected"
    const [confirmedThumbIndex, setConfirmedThumbIndex] = useState(null);
    // server/local URL of confirmed/uploaded thumbnail — helps when server returns a different URL than the generated data URL
    const [confirmedThumbUrl, setConfirmedThumbUrl] = useState(null);
    // display size for generated thumbnails to match the modal video display
    const [thumbSize, setThumbSize] = useState({ width: 160, height: 90 });
    // separate refs for main UI video and modal video to avoid clobbering
    const videoRefMain = React.useRef(null);
    const videoRefModal = React.useRef(null);
    // track whether the modal/main preview is playing
    const [isPlayingModal, setIsPlayingModal] = useState(false);
    const [createdObjectUrl, setCreatedObjectUrl] = useState(null);
    // mainSrc is the canonical src used by the main preview player when user selects a record
    const [mainSrc, setMainSrc] = useState(null);
    // flash state for thumbnail prompt when user attempts to close without selecting a thumbnail
    const [flashPrompt, setFlashPrompt] = useState(false);
    const flashTimersRef = React.useRef([]);
    // track which record id is currently playing in the list (null = none)
    const [playingId, setPlayingId] = useState(null);
    // selected record for playlist main player
    const [selectedRecordId, setSelectedRecordId] = useState(null);
    // modal preview time/duration (keeps previous behavior for the modal)
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    // per-record time/duration maps (recordId -> seconds)
    const [currentTimes, setCurrentTimes] = useState({});
    const [durationsMap, setDurationsMap] = useState({});
	const pageSize = 8; 
    // New: store fetched video records list and pagination state
    const [records, setRecords] = useState([]);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [loading, setLoading] = useState(false);
    // refs to avoid duplicate fetches
    const fetchInFlightRef = React.useRef(new Set());
    // Map of media (video) element refs keyed by record id
    const mediaRefs = React.useRef(new Map());
    // sentinel for IntersectionObserver infinite scroll
    const sentinelRef = React.useRef(null);
    // ref for the scrollable playlist container so we can observe its scroll (observer root)
    const playlistRef = React.useRef(null);
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

    // Debug flag: enable by adding ?debugVideo=1 to the URL
    const debugVideo = React.useMemo(() => {
      try { return typeof window !== 'undefined' && (new URLSearchParams(window.location.search)).get('debugVideo') === '1'; } catch (e) { return false; }
    }, []);

    // New: pending delete state to avoid window.confirm modal
    const [pendingDeleteId, setPendingDeleteId] = useState(null);
    const [deletingId, setDeletingId] = useState(null);

    // When uploadedVideoSrc changes, make sure any video element loads it.
    useEffect(() => {
      if (!uploadedVideoSrc) {
        return undefined;
      }
      try {
        // load preview into both main and modal video elements but only start modal/main preview (not list items)
        [videoRefMain.current, videoRefModal.current].forEach(v => {
          if (v) {
            if (v.src !== uploadedVideoSrc) v.src = uploadedVideoSrc;
            try { v.load(); } catch(e){}
          }
        });
        // play modal preview if available
        if (videoRefModal.current) {
          videoRefModal.current.play().then(() => setIsPlayingModal(true)).catch(()=>{});
        }
        // when an uploaded preview appears, clear any explicit mainSrc so uploaded preview is preferred
        try { setMainSrc(null); } catch(e) {}
      } catch (err) {
        console.warn('Error loading video preview', err);
      }
      return undefined;
    }, [uploadedVideoSrc]);

    // Revoke any created object URL when it changes or on unmount
    useEffect(() => {
      return () => {
        if (createdObjectUrl) {
          try { URL.revokeObjectURL(createdObjectUrl); } catch (e) {}
        }
      };
    }, [createdObjectUrl]);

    // Ensure any flash timers are cleaned up if component unmounts unexpectedly
    useEffect(() => {
      return () => {
        try {
          if (flashTimersRef.current && flashTimersRef.current.length) {
            flashTimersRef.current.forEach(id => clearTimeout(id));
          }
          flashTimersRef.current = [];
        } catch (e) {}
      };
    }, []);

    // Paginated fetch for video records. Can request any page; append when needed.
    const fetchVideos = async (requestedPage = 1, append = false) => {
      console.debug('[Video] fetchVideos called', { requestedPage, append, xid });
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
          collName: 'video',
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
        console.warn('[Video] fetchVideos error', err);
      } finally {
        setLoading(false);
        try { fetchInFlightRef.current.delete(requestedPage); } catch(e){}
      }
    };

    // Initial load
    useEffect(() => {
      if (!xid) return;
      fetchVideos(1, false);
    }, [xid]);

    const handleLoadMore = () => {
      console.debug('[Video] handleLoadMore called', { page, loading, hasMore });
      if (!hasMore) return;
      // If any fetch is in flight, avoid starting another page to prevent multiple simultaneous page loads
      if (loading) return;
      if (fetchInFlightRef.current && fetchInFlightRef.current.size > 0) return;
      const next = page + 1;
      if (fetchInFlightRef.current && fetchInFlightRef.current.has(next)) return;
      fetchVideos(next, true).catch(()=>{});
     };

    // Only create IntersectionObserver after user has interacted
    React.useEffect(() => {
      // do not attach observer until user interacts; keeps initial load to page 1
      if (!userInteracted) return undefined;
      const el = sentinelRef.current;
      const rootEl = playlistRef.current || null; // use playlist as root when available
      if (!el) return undefined;
      if (!hasMore) return undefined;
      try {
        const observer = new IntersectionObserver((entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              console.debug('[Video] IntersectionObserver triggered load (playlist root)');
              handleLoadMore();
            }
          });
        }, {
          root: rootEl,
          rootMargin: '100px',
          threshold: 0
        });
        observer.observe(el);
        return () => {
          try { observer.unobserve(el); } catch (e) {}
          try { observer.disconnect(); } catch (e) {}
        };
      } catch (e) {
        // Fall back silently if IntersectionObserver setup fails
        return undefined;
      }
    }, [loading, hasMore, page, xid, userInteracted]);

    // Fallback: listen to the playlist's scroll event and trigger load when near the bottom
    React.useEffect(() => {
      if (!userInteracted) return undefined;
      const root = playlistRef.current;
      if (!root) return undefined;
      const onScrollLocal = () => {
        if (loading || !hasMore) return;
        try {
          const remaining = root.scrollHeight - root.scrollTop - root.clientHeight;
          const threshold = 240; // px from bottom
          if (remaining <= threshold) {
            console.debug('[Video] playlist scroll fallback triggered load');
            handleLoadMore();
          }
        } catch (e) {}
      };
      root.addEventListener('scroll', onScrollLocal, { passive: true });
      return () => { try { root.removeEventListener('scroll', onScrollLocal); } catch (e) {} };
    }, [loading, hasMore, page, xid, userInteracted]);

    // open modal and create placeholder record so DropVideo can attach to it
    const handleOpen = async () => {
        // Reset state first
        setVideoID(null);
        setUploaded(false);
        setModalMessage(null);
        setUploadedVideoSrc(null);
        setThumbnailSrc(null);
        setThumbnailSrcs([]);
        setConfirmedThumbIndex(null);
        setCreatedObjectUrl(null);
        setSelectedThumbIndex(null);
        setIsPlayingModal(false);
        setCurrentTime(0);
        setDuration(0);
        setIsEditingTitle(false);

        // Create placeholder record first, then open modal so DropVideo receives compId immediately
        if (!xid) {
            setIsModalOpen(true);
            return;
        }

        try {
            const payload = {
                "dbName": objDBName,
                "collName": "video",
                "docContents": "{'xid':'" + xid + "'}",
                "uKey": "0"
            };
            const response = await axios.post(API_BASE_URL + '/newObject', payload);
            // store returned id for later use even if doc_201 message is not present
            if (response && response.status === 200) {
                let returnedId = response.data && (response.data._id || response.data.insertedId || response.data.compId);
                // normalize empty-string -> null
                if (typeof returnedId === 'string') returnedId = returnedId.trim() || null;
                console.debug('[Video] newObject returned id:', returnedId, response.data);
                setVideoID(returnedId || null);
            }
        } catch (err) {
            console.error('[Video] error creating placeholder video record', err);
            setModalMessage('Failed to create placeholder record');
        }

        // Open modal after attempting to create the record
        setIsModalOpen(true);
    };

    // close modal; if placeholder was created and no upload happened, remove it
    const handleClose = async () => {
        try {
            if (videoID && !uploaded) {
                const payload = {
                    "dbName": objDBName,
                    "collName": "video",
                    "docContents": "{'_id':'" + videoID + "'}",
                    "uKey": "_id"
                };
                await axios.post(API_BASE_URL + '/removeObject', payload);
            }
        } catch (err) {
            console.log('[Video] failed to cleanup created record on close', err);
        }
        // clear any flashing timers when actually closing
        try {
          if (flashTimersRef.current && flashTimersRef.current.length) {
            flashTimersRef.current.forEach(id => clearTimeout(id));
          }
          flashTimersRef.current = [];
        } catch (e) {}
        setIsModalOpen(false);
        setVideoID(null);
        setTitle('');
        setUploaded(false);
        setModalMessage(null);
        setUploadedVideoSrc(null);
        setThumbnailSrc(null);
        setIsPlayingModal(false);
        setCurrentTime(0);
        setDuration(0);
        setIsEditingTitle(false);
        setConfirmedThumbIndex(null);
        setConfirmedThumbUrl(null);
        setFlashPrompt(false);

        // Reload the video records so the list reflects any newly uploaded or removed items
        try {
          await fetchVideos(1, false);
        } catch (e) {
          // ignore fetch errors here but log for debugging
          console.warn('[Video] failed to refresh list after modal close', e);
        }
    };

    // Called when the close (X) button is clicked. If the video was uploaded but no thumbnail
    // has been confirmed, flash the prompt instead of closing. Otherwise perform normal close.
    const handleCloseClick = (e) => {
      try { e && e.stopPropagation(); } catch (er) {}
      const hasConfirmed = (confirmedThumbIndex !== null) || (confirmedThumbUrl !== null);
      if (uploaded && !hasConfirmed) {
        // flash the prompt in orange three times
        startFlashPrompt(3);
        return;
      }
      // otherwise perform normal close
      try { handleClose(); } catch (err) {}
    };

    const startFlashPrompt = (times = 3) => {
      // clear previous timers
      try {
        if (flashTimersRef.current && flashTimersRef.current.length) {
          flashTimersRef.current.forEach(id => clearTimeout(id));
        }
        flashTimersRef.current = [];
      } catch (e) {}
      // schedule flashes: each pulse shows orange for 400ms then normal for 400ms
      for (let i = 0; i < times; i++) {
        const onAt = setTimeout(() => setFlashPrompt(true), i * 800);
        const offAt = setTimeout(() => setFlashPrompt(false), i * 800 + 400);
        flashTimersRef.current.push(onAt, offAt);
      }
      // ensure prompt off after all pulses
      const endAt = setTimeout(() => { setFlashPrompt(false); flashTimersRef.current = []; }, times * 800 + 100);
      flashTimersRef.current.push(endAt);
    };

    // Called by DropVideo when upload succeeds
    const handleUploadSuccess = (uploadResponse) => {
        console.log('[Video] uploadResponse=', uploadResponse);
        setUploaded(true);
        setModalMessage('Video uploaded');
        setTimeout(() => setModalMessage(null), 3000);

        // normalize possible shapes: either server response OR { response, file }
        if (!uploadResponse) return;

        // prefer a provided local object URL (DropVideo now includes localUrl) for thumbnail extraction
        const localUrl = uploadResponse.localUrl || (uploadResponse.response && uploadResponse.response.localUrl) || null;
        const serverUrl = uploadResponse.videoUrl || (uploadResponse.response && (uploadResponse.response.video || uploadResponse.response.fileUrl || uploadResponse.response.url || uploadResponse.response.path || uploadResponse.response.file || null)) || null;

        // helper to attempt generating thumbnail (best-effort)
        const tryGenerate = async (src) => {
          if (!src) return null;
          try {
            const data = await generateThumbnailFromVideoSrc(src);
            return data;
          } catch (e) {
            return null;
          }
        };

        // attempt to generate multiple thumbnails (returns array)
        const tryGenerateMultiple = async (src, count = 3) => {
          if (!src) return [];
          try {
            const arr = await generateMultipleThumbnails(src, count);
            return arr || [];
          } catch (e) {
            return [];
          }
        };

        // If we have a local blob URL, prefer it for preview and thumbnail (no CORS issues)
        if (localUrl) {
          setUploadedVideoSrc(localUrl);
          tryGenerateMultiple(localUrl, 3).then((arr) => { if (arr && arr.length>0) { setThumbnailSrcs(arr); setThumbnailSrc(arr[0]||null); setSelectedThumbIndex(null); setConfirmedThumbIndex(null); } }).catch(()=>{});
        }

        // If server provided a final URL, set as canonical preview (but keep local preview if present)
        if (serverUrl) {
          let final = serverUrl;
          if (!final.startsWith('http')) {
            const base = (typeof CDNURL === 'string' && CDNURL) ? CDNURL : API_BASE_URL;
            if (base) {
              const baseNoSlash = String(base).replace(/\/+$/g, '');
              const pathNoLeading = String(final || '').replace(/^\/+/, '');
              final = baseNoSlash + '/' + pathNoLeading;
              final = final.replace(/([^:])\/\/{2,}/g, '$1/');
            } else {
              final = final.replace(/([^:])\/\/{2,}/g, '$1/');
            }
          }
          // If there's no localUrl, show server URL in modal preview
          if (!localUrl) setUploadedVideoSrc(final);
          // attempt to extract thumbnail from server URL (may fail due to CORS)
          if (!thumbnailSrc) {
            // try to generate multiple thumbnails from server URL (may fail due to CORS)
            tryGenerateMultiple(final, 3).then((arr) => { if (arr && arr.length>0) { setThumbnailSrcs(arr); setThumbnailSrc(arr[0]||null); setSelectedThumbIndex(null); setConfirmedThumbIndex(null); } }).catch(()=>{});
          }
        }

        // If uploadResponse contains server response with id, update it
        const srv = uploadResponse.response || uploadResponse;
        const possibleId = srv && (srv._id || srv.compId || srv.insertedId);
        if (possibleId) setVideoID(possibleId);

        // reset modal player state
        setCurrentTime(0);
        setDuration(0);
        setIsPlayingModal(false);
        return;
    };

    // Generate a thumbnail data URL from a video src (object URL, blob URL or remote URL).
    // Returns a Promise<string|null> with a base64 data URL or null on failure.
    const generateThumbnailFromVideoSrc = (videoSrc) => {
      return new Promise((resolve) => {
        if (!videoSrc) return resolve(null);
        let vid = null;
        let timeoutId = null;
        try {
          vid = document.createElement('video');
          vid.preload = 'metadata';
          vid.muted = true;
          vid.playsInline = true;
          try { if (typeof videoSrc === 'string' && !videoSrc.startsWith('data:') && !videoSrc.startsWith('blob:')) vid.crossOrigin = 'anonymous'; } catch (e) {}
          vid.src = videoSrc;

          // Attach hidden to DOM — some browsers require this for frame decoding/rendering
          vid.style.position = 'absolute';
          vid.style.left = '-9999px';
          vid.style.width = '160px';
          vid.style.height = '90px';
          vid.style.opacity = '0';
          document.body.appendChild(vid);

          const cleanup = () => {
            try { if (timeoutId) { clearTimeout(timeoutId); timeoutId = null; } } catch (e) {}
            try { vid.removeEventListener('loadedmetadata', onLoadedMeta); } catch (e) {}
            try { vid.onseeked = null; } catch (e) {}
            try { vid.removeEventListener('error', onError); } catch (e) {}
            try { vid.pause(); vid.removeAttribute('src'); vid.load(); } catch (e) {}
            try { if (vid.parentNode) vid.parentNode.removeChild(vid); } catch (e) {}
            vid = null;
          };

          const finalize = (data) => {
            cleanup();
            resolve(data);
          };

          const onError = () => { finalize(null); };

          const getImageData = () => {
            try {
              const canvas = document.createElement('canvas');
              const w = vid.videoWidth || 320;
              const h = vid.videoHeight || 180;
              const maxW = 320;
              const scale = Math.min(1, maxW / w);
              canvas.width = Math.floor(w * scale);
              canvas.height = Math.floor(h * scale);
              const ctx = canvas.getContext('2d');
              ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
              return { canvas, ctx, imageData: ctx.getImageData(0, 0, canvas.width, canvas.height) };
            } catch (e) {
              return null;
            }
          };

          const isMostlyBlack = (imageData) => {
            if (!imageData || !imageData.data) return true;
            const data = imageData.data;
            let total = 0;
            const len = data.length;
            // sample every 4th pixel to speed up
            let count = 0;
            for (let i = 0; i < len; i += 16) {
              const r = data[i];
              const g = data[i+1];
              const b = data[i+2];
              // luminance
              const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
              total += lum;
              count++;
            }
            const avg = total / Math.max(1, count);
            // consider mostly black if average luminance very low
            return avg < 12; // threshold (0-255)
          };

          const imageDataToDataUrl = (imageDataObj) => {
            try {
              return imageDataObj.canvas.toDataURL('image/jpeg', 0.8);
            } catch (e) { return null; }
          };

          // try multiple seek targets to avoid black frames
          const tryTimes = async (times) => {
            for (let t of times) {
              let got = await seekAndCapture(t);
              if (got) return got;
            }
            return null;
          };

          const seekAndCapture = (target) => {
            return new Promise((res) => {
              let localTimeout = null;
              const onSeek = () => {
                // give browser a frame to render
                requestAnimationFrame(() => {
                  setTimeout(() => {
                    const img = getImageData();
                    if (!img) {
                      clearListeners();
                      return res(null);
                    }
                    if (!isMostlyBlack(img.imageData)) {
                      const url = imageDataToDataUrl(img);
                      clearListeners();
                      return res(url);
                    }
                    // black frame -> continue
                    clearListeners();
                    return res(null);
                  }, 40);
                });
              };

              const onErr = () => { clearListeners(); res(null); };

              const clearListeners = () => {
                try { vid.removeEventListener('seeked', onSeek); } catch (e) {}
                try { vid.removeEventListener('error', onErr); } catch (e) {}
                try { if (localTimeout) { clearTimeout(localTimeout); localTimeout = null; } } catch (e) {}
              };

              vid.addEventListener('seeked', onSeek);
              vid.addEventListener('error', onErr);
              try {
                vid.currentTime = Math.max(0, Math.min((vid.duration || 0), target));
              } catch (e) {
                // if seeking fails, resolve null for this attempt
                clearListeners();
                return res(null);
              }

              localTimeout = setTimeout(() => { clearListeners(); res(null); }, 2000);
            });
          };

          const onLoadedMeta = async () => {
            // Build a set of candidate times to try: small offsets and midpoints
            const dur = Math.max(0, vid.duration || 0);
            const candidates = [];
            // try small offsets first (to avoid black leader), then midpoints
            candidates.push(0.1, 0.3, 0.6, 1);
            if (dur > 2) candidates.push(dur * 0.25, dur * 0.5, dur * 0.75);
            // clamp within duration
            const times = candidates.map(t => Math.min(dur, Math.max(0, t))).filter((v,i,arr) => arr.indexOf(v)===i);
            const result = await tryTimes(times);
            if (result) return finalize(result);
            // last-resort: try capturing current frame without seeking
            const img = getImageData();
            if (img && !isMostlyBlack(img.imageData)) {
              const url = imageDataToDataUrl(img);
              return finalize(url);
            }
            // could not get good thumbnail
            return finalize(null);
          };

          vid.addEventListener('loadedmetadata', onLoadedMeta);
          vid.addEventListener('error', onError);

          // Fail-safe: give up after 6s
          timeoutId = setTimeout(() => { finalize(null); }, 6000);

          try { vid.load(); } catch (e) {}
        } catch (e) {
          try { if (vid && vid.parentNode) vid.parentNode.removeChild(vid); } catch (er) {}
          resolve(null);
        }
      });
    };

    // Generate multiple thumbnails (data URLs) from a video source.
    // Attempts to capture frames at three positions: start offset, mid, near-end.
    // Returns Promise<string[]> (may contain nulls filtered out).
    const generateMultipleThumbnails = (videoSrc, count = 3) => {
      return new Promise((resolve) => {
        if (!videoSrc) return resolve([]);
        let vid = null;
        let timeoutId = null;
        try {
          vid = document.createElement('video');
          vid.preload = 'metadata';
          vid.muted = true;
          vid.playsInline = true;
          try { if (typeof videoSrc === 'string' && !videoSrc.startsWith('data:') && !videoSrc.startsWith('blob:')) vid.crossOrigin = 'anonymous'; } catch (e) {}
          vid.src = videoSrc;
          // hidden
          vid.style.position = 'absolute'; vid.style.left = '-9999px'; vid.style.width = '160px'; vid.style.height = '90px'; vid.style.opacity = '0';
          document.body.appendChild(vid);

          const cleanup = () => {
            try { if (timeoutId) { clearTimeout(timeoutId); timeoutId = null; } } catch (e) {}
            try { vid.removeEventListener('loadedmetadata', onLoadedMeta); } catch (e) {}
            try { vid.removeEventListener('error', onError); } catch (e) {}
            try { vid.pause(); vid.removeAttribute('src'); vid.load(); } catch (e) {}
            try { if (vid.parentNode) vid.parentNode.removeChild(vid); } catch (e) {}
            vid = null;
          };

          const onError = () => { cleanup(); resolve([]); };

          const captureFrame = () => {
            try {
              const canvas = document.createElement('canvas');
              const w = vid.videoWidth || 320;
              const h = vid.videoHeight || 180;
              const maxW = 320;
              const scale = Math.min(1, maxW / w);
              canvas.width = Math.floor(w * scale);
              canvas.height = Math.floor(h * scale);
              const ctx = canvas.getContext('2d');
              ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
              return canvas.toDataURL('image/jpeg', 0.8);
            } catch (e) {
              return null;
            }
          };

          const seekAndCapture = (t) => {
            return new Promise((res) => {
              let localTimeout = null;
              const onSeek = () => {
                requestAnimationFrame(() => {
                  setTimeout(() => {
                    const data = captureFrame();
                    clearListeners();
                    return res(data);
                  }, 40);
                });
              };
              const onErr = () => { clearListeners(); res(null); };
              const clearListeners = () => {
                try { vid.removeEventListener('seeked', onSeek); } catch (e) {}
                try { vid.removeEventListener('error', onErr); } catch (e) {}
                try { if (localTimeout) { clearTimeout(localTimeout); localTimeout = null; } } catch (e) {}
              };
              vid.addEventListener('seeked', onSeek);
              vid.addEventListener('error', onErr);
              try {
                vid.currentTime = Math.max(0, Math.min((vid.duration || 0), t));
              } catch (e) {
                clearListeners(); return res(null);
              }
              localTimeout = setTimeout(() => { clearListeners(); res(null); }, 2000);
            });
          };

          const onLoadedMeta = async () => {
            const dur = Math.max(0, vid.duration || 0);
            if (dur <= 0) { cleanup(); return resolve([]); }
            // choose times: avoid absolute start/end; spread across duration
            const positions = [];
            for (let i=1;i<=count;i++) {
              const frac = i / (count + 1);
              positions.push(Math.min(dur, Math.max(0, dur * frac)));
            }
            const results = [];
            for (let t of positions) {
              try {
                const d = await seekAndCapture(t);
                if (d) results.push(d);
              } catch (e) {}
            }
            cleanup();
            resolve(results.filter(Boolean));
          };

          vid.addEventListener('loadedmetadata', onLoadedMeta);
          vid.addEventListener('error', onError);
          timeoutId = setTimeout(() => { cleanup(); resolve([]); }, 8000);
          try { vid.load(); } catch (e) {}
        } catch (e) {
          try { if (vid && vid.parentNode) vid.parentNode.removeChild(vid); } catch (er) {}
          resolve([]);
        }
      });
    };

    // use event-based handlers so they work for either video element
    const onTimeUpdate = (e) => {
      const media = e && e.target ? e.target : null;
      if (!media) return;
      // if this is the modal/main preview media element, update modal state
      if (media === videoRefModal.current || media === videoRefMain.current) {
        setCurrentTime(media.currentTime);
        return;
      }
      // otherwise, use data-record-id to update per-record time
      const rid = media.dataset && media.dataset.recordId ? media.dataset.recordId : null;
      if (rid) {
        setCurrentTimes(prev => ({ ...(prev || {}), [rid]: media.currentTime }));
      }
    };

    const onLoadedMetadata = (e) => {
      const media = e && e.target ? e.target : null;
      if (!media) return;
      if (media === videoRefModal.current || media === videoRefMain.current) {
        setDuration(media.duration || 0);
        return;
      }
      const rid = media.dataset && media.dataset.recordId ? media.dataset.recordId : null;
      if (rid) {
        setDurationsMap(prev => ({ ...(prev || {}), [rid]: media.duration || 0 }));
      }
    };

    // seek handler for modal/main preview video
    const onSeek = (e) => {
      const val = Number(e.target.value || 0);
      const media = (isModalOpen ? videoRefModal.current : videoRefMain.current) || videoRefMain.current || videoRefModal.current;
      if (!media) return;
      try { media.currentTime = val; } catch (err) {}
      setCurrentTime(val);
    };

    // seek handler for a specific record's video element
    const onSeekRecord = (e, rid) => {
      const val = Number(e.target.value || 0);
      const a = mediaRefs.current.get(String(rid));
      if (!a) return;
      try { a.currentTime = val; } catch (err) {}
      setCurrentTimes(prev => ({ ...(prev || {}), [rid]: val }));
    };

    // send title update to backend
    const handleTitleConfirm = async () => {
      if (!videoID) {
        setModalMessage('No video record to update');
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
        collName: 'video',
        docContents: "{'_id':'" + videoID + "','title':'" + safeTitle + "'}",
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
              if (String(r._id) === String(videoID)) {
                return { ...r, title: trimmed };
              }
              return r;
            });
          });
        } else {
          console.warn('[Video] editObject unexpected response', res);
          setModalMessage('Failed to update title');
          setTimeout(() => setModalMessage(null), 3000);
        }
      } catch (err) {
        console.error('[Video] failed to update title', err);
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
        collName: 'video',
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
          console.warn('[Video] editObject unexpected response', res);
        }
      } catch (err) {
        console.error('[Video] failed to update title (inline)', err);
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
        collName: 'video',
        docContents: "{'_id':'" + key + "'}",
        uKey: '_id'
      };
      try {
        const res = await axios.post(API_BASE_URL + '/removeObject', payload);
        if (res && (res.status === 200 || res.status === 204)) {
          // stop and cleanup video element if present
          try {
            const a = mediaRefs.current.get(key);
            if (a) { a.pause(); mediaRefs.current.delete(key); }
          } catch (e) {}
          // remove from records
          setRecords(prev => (prev || []).filter(r => String(r._id || r.compId || r.insertedId) !== key));
          if (playingId === key) setPlayingId(null);
        } else {
          console.warn('[Video] removeObject unexpected response', res);
        }
      } catch (err) {
        console.error('[Video] failed to remove record', err);
      } finally {
        setDeletingId(null);
        setPendingDeleteId(null);
      }
    };

    // Upload a selected thumbnail (data URL) and attach it to the video record via /uploadFile
    const uploadSelectedThumbnail = async (dataUrl, idx = null) => {
      // NOTE: signature changed to accept optional index param by callsites; preserved for backward compatibility
      if (!dataUrl) return;
      if (!videoID) {
        setModalMessage('No video record id available to attach thumbnail');
        setTimeout(() => setModalMessage(null), 3000);
        return;
      }
      setIsThumbUploadingModal(true);
      setThumbUploadProgressModal(0);
      try {
        const fetched = await fetch(dataUrl);
        const blob = await fetched.blob();
        const safeName = (title && title.trim()) ? title.trim().replace(/\s+/g,'_') : String(videoID);
        const fileName = `thumb_${safeName}.jpg`;
        const formData = new FormData();
        formData.append('files', blob, fileName);
        formData.append('xid', xid);
        formData.append('type', 'videoThumbnail');
        formData.append('folder', 'videoThumbnail');
        formData.append('dbName', objDBName);
        formData.append('compId', String(videoID));
        formData.append('collName', 'video');

        const resp = await axios.post(API_BASE_URL + '/uploadFile', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (progressEvent) => {
            try {
              if (progressEvent && progressEvent.total) {
                const pct = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                setThumbUploadProgressModal(pct);
              }
            } catch (e) {}
          }
        });

        if (resp && (resp.status === 200 || resp.status === 201 || resp.status === 204)) {
          console.debug('[Video] thumbnail upload success', { idx, resp });
          // prefer server-returned URL if present
          let uploadedThumbUrl = null;
          try {
            const d = resp.data || {};
            // common shapes: d.url, d.fileUrl, d.path, d.file, d.files (array)
            uploadedThumbUrl = d.url || d.fileUrl || d.path || d.file || (Array.isArray(d.files) && d.files[0]) || null;
            if (uploadedThumbUrl && typeof uploadedThumbUrl === 'object' && uploadedThumbUrl.path) uploadedThumbUrl = uploadedThumbUrl.path;
            if (uploadedThumbUrl && typeof uploadedThumbUrl === 'string' && !uploadedThumbUrl.startsWith('http')) {
              const base = (typeof CDNURL === 'string' && CDNURL) ? CDNURL : API_BASE_URL;
              if (base) {
                const baseNoSlash = String(base).replace(/\/+$/g, '');
                const pathNoLeading = String(uploadedThumbUrl || '').replace(/^\/+/, '');
                uploadedThumbUrl = baseNoSlash + '/' + pathNoLeading;
                uploadedThumbUrl = uploadedThumbUrl.replace(/([^:])\/\/{2,}/g, '$1/');
              } else {
                uploadedThumbUrl = uploadedThumbUrl.replace(/([^:])\/\/{2,}/g, '$1/');
              }
            }
          } catch (e) { uploadedThumbUrl = null; }

          // update modal preview using server url when available; fall back to local dataUrl
          const previewUrl = uploadedThumbUrl || dataUrl;

          // replace thumbnailSrcs[idx] with previewUrl so UI's t matches the uploaded URL
          try {
            if (typeof idx === 'number' && Array.isArray(thumbnailSrcs)) {
              setThumbnailSrcs(prev => {
                const copy = Array.isArray(prev) ? prev.slice() : [];
                if (idx >= 0) copy[idx] = previewUrl;
                return copy;
              });
            }
          } catch (e) { console.debug('[Video] failed to update thumbnailSrcs', e); }

          // also store the actual URL returned/used so button can match even if server URL differs from data URL
          setConfirmedThumbUrl(previewUrl || null);
          // mark the confirmed index so other thumbnails become non-selectable
          if (typeof idx === 'number' && idx >= 0) {
            setConfirmedThumbIndex(idx);
            // ensure the confirmed thumbnail is highlighted/selected in the UI
            try { setSelectedThumbIndex(idx); } catch (e) {}
          }

          setModalMessage('Thumbnail uploaded');

          // Persist the thumbnail URL on the video record so later list fetches can show it
          try {
            const safeUrl = (previewUrl || '').replace(/'/g, "\\'");
            if (safeUrl) {
              const payload = {
                dbName: objDBName,
                collName: 'video',
                docContents: "{'_id':'" + String(videoID) + "','videoThumbnail':'" + safeUrl + "'}",
                uKey: '_id',
                updateKey: 'videoThumbnail'
              };
              // best-effort, do not block the UI; log errors
              axios.post(API_BASE_URL + '/editObject', payload).then((r) => {
                console.debug('[Video] saved videoThumbnail on record', r && r.status);
              }).catch((err) => {
                console.warn('[Video] failed to persist videoThumbnail on record', err);
              });
            }
          } catch (e) { console.warn('[Video] error persisting thumbnail', e); }

          // refresh list so poster/thumbnail fields are updated (do not await before updating UI state)
          fetchVideos(1, false).catch(() => {});
          setTimeout(() => setModalMessage(null), 3000);
        } else {
          console.warn('Thumbnail upload returned unexpected status', resp && resp.status);
          setModalMessage('Thumbnail upload failed');
          setTimeout(() => setModalMessage(null), 3000);
        }
      } catch (err) {
        console.error('Thumbnail upload error', err);
        setModalMessage('Thumbnail upload failed');
        setTimeout(() => setModalMessage(null), 3000);
      } finally {
        setIsThumbUploadingModal(false);
        setThumbUploadProgressModal(null);
      }
    };

    // Ensure we auto-select the first record when the list loads (if none selected)
    useEffect(() => {
      if ((!selectedRecordId || selectedRecordId === null) && records && records.length > 0) {
        const first = records[0];
        const id = first && (first._id || first.compId || first.insertedId);
        if (id) setSelectedRecordId(String(id));
      }
    }, [records]);

    // When selectedRecordId changes, load its src into the main preview videoRefMain
    const selectRecord = (rec) => {
      if (!rec) return;
      const id = rec._id || rec.compId || rec.insertedId;
      if (!id) return;
      const key = String(id);
      try { console.debug('[Video] selectRecord called', { key, rec }); } catch(e) {}
      setSelectedRecordId(key);
      // build candidate src from record fields (same logic used elsewhere)
      let src = rec.video || rec.fileUrl || rec.url || rec.path || rec.file || null;
      if (src && !src.startsWith('http') && !src.startsWith('//')) {
        const base = (typeof CDNURL === 'string' && CDNURL) ? CDNURL : API_BASE_URL;
        src = joinUrl(base, src);
      }
      try { console.debug('[Video] selectRecord computed src', src); } catch(e) {}
      // Use React state so effect can synchronously update DOM and avoid race conditions
      setMainSrc(src || null);
    };

    // Effect: when mainSrc changes try to load it into the main video element
    useEffect(() => {
      if (!mainSrc) {
        // if null, do nothing (uploaded preview or fallback will be used via mainPreviewSrc)
        try {
          if (videoRefMain.current) {
            // leave uploadedVideoSrc or existing src alone
          }
        } catch (e) {}
        return;
      }
      try {
        if (videoRefMain.current) {
          if (videoRefMain.current.src !== mainSrc) {
            try { videoRefMain.current.src = mainSrc; } catch (e) {}
          }
          try { videoRefMain.current.load(); } catch (e) {}
          videoRefMain.current.play().then(() => setPlayingId(selectedRecordId)).catch(()=>{});
        }
      } catch (e) {}
    }, [mainSrc, selectedRecordId]);

    // compute main preview src outside JSX to avoid inline IIFE and ensure variable is defined
    let mainPreviewSrc = mainSrc || uploadedVideoSrc;
    if (!mainPreviewSrc && records && selectedRecordId) {
      const rec = (records || []).find(rr => String(rr._id || rr.compId || rr.insertedId) === String(selectedRecordId));
      if (rec) {
        let s = rec.video || rec.fileUrl || rec.url || rec.path || rec.file || undefined;
        if (s && !s.startsWith('http')) {
          const base = (typeof CDNURL === 'string' && CDNURL) ? CDNURL : API_BASE_URL;
          s = joinUrl(base, s);
        }
        mainPreviewSrc = s;
      }
    }

    // compute a title to display on the main player (prefer modal/upload title, otherwise the selected record's title)
    let mainDisplayTitle = null;
    try {
      if (title && String(title).trim()) {
        // prefer the edited/uploaded title when present
        mainDisplayTitle = String(title).trim();
      } else if (records && selectedRecordId) {
        const rec = (records || []).find(rr => String(rr._id || rr.compId || rr.insertedId) === String(selectedRecordId));
        if (rec) mainDisplayTitle = rec.title || '(untitled)';
      }
    } catch (e) { mainDisplayTitle = null; }

    return (
        <div style={{ padding: 16 }}>
            {isEdit && (
                <div className="addButton">
                    <Button className="button-8 add-button-plain" endIcon={<VideocamOutlinedIcon fontSize="small" />} onClick={handleOpen} variant="text" disableElevation disableRipple>
                        + Video
                    </Button>
                </div>
            )}
        
            {/* Render paginated list of video records */}
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

                  // two-column layout: left = playlist, right = main player / details
                  return (
                    <>
                      <div style={{ display: 'flex', gap: 16 }}>
                        {/* LEFT: Playlist */}
                        <div ref={playlistRef} style={{ width: 300, maxHeight: 520, overflow: 'auto', padding: 8, borderRight: '1px solid #eee' }}>
                          {dateKeys.map((dk) => (
                            <div key={dk} style={{ marginBottom: 12 }}>
                              <div style={{ fontSize: 13, margin: '6px 0', fontWeight: 600 }}>{formatDateHeader(dk)}</div>
                              {grouped[dk].map((rec) => {
                                const id = rec._id || rec.compId || rec.insertedId;
                                const key = String(id);
                                const isSelected = selectedRecordId === key;
                                const poster = getPosterUrl(rec);
                                return (
                                  <div
                                     key={key}
                                     onClick={() => selectRecord(rec)}
                                     style={{
                                       padding: '8px 6px',
                                       borderRadius: 6,
                                       cursor: 'pointer',
                                       background: isSelected ? '#eef6ff' : 'transparent',
                                       marginBottom: 6,
                                     }}
                                   >
                                     {/* New vertical layout: title on its own row above the thumbnail */}
                                     <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                                       <div style={{ flex: 1 }}>
                                         {/* Title row (no delete button here any more) */}
                                         <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                          {/* Make the title take the full available row space. Put edit button at the far right. */}
                                          {editingRecordId === key ? (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                                              <div style={{ minWidth: 0, flex: '1 1 auto' }}>
                                                <TextField
                                                  value={editingRecordTitle}
                                                  onChange={(e) => setEditingRecordTitle(e.target.value)}
                                                  size="small"
                                                  variant="standard"
                                                  onKeyDown={(e) => {
                                                    if (e.key === 'Enter') { e.preventDefault(); confirmEditRecord(key); }
                                                    if (e.key === 'Escape') { e.preventDefault(); cancelEditRecord(); }
                                                  }}
                                                  autoFocus
                                                  inputProps={{ style: { fontSize: 13 } }}
                                                  fullWidth
                                                />
                                              </div>
                                              <div style={{ flex: '0 0 auto' }}>
                                                <IconButton
                                                  size="small"
                                                  aria-label="confirm"
                                                  onClick={(e) => { e.stopPropagation(); confirmEditRecord(key); }}
                                                >
                                                  <CheckIcon fontSize="small" />
                                                </IconButton>
                                              </div>
                                            </div>
                                          ) : (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}>
                                              <div style={{
                                                fontSize: 14,
                                                fontWeight: 500,
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                display: '-webkit-box',
                                                WebkitLineClamp: 2,
                                                WebkitBoxOrient: 'vertical',
                                                overflowWrap: 'break-word',
                                                minWidth: 0,
                                                flex: '1 1 auto'
                                              }}>{rec.title || '(untitled)'}</div>
                                              {isEdit && (
                                                <div style={{ flex: '0 0 auto' }}>
                                                  <IconButton
                                                    aria-label="edit title"
                                                    size="small"
                                                    onClick={(e) => { e.stopPropagation(); startEditRecord(rec); }}
                                                  >
                                                    <EditIcon fontSize="small" />
                                                  </IconButton>
                                                </div>
                                              )}
                                            </div>
                                          )}
                                         </div>

                                         {/* Thumbnail row underneath the title. Delete button moved here next to the thumbnail */}
                                         <div
                                           style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
                                           onClick={(e) => { try { e.stopPropagation(); selectRecord(rec); } catch(err){} }}
                                         >
                                           <div style={{ width: 72, height: 90, flex: '0 0 72px' }}>
                                             {poster ? (
                                               <img
                                                 src={poster}
                                                 alt={rec.title || 'thumbnail'}
                                                 onClick={(e) => { try { e.stopPropagation(); selectRecord(rec); } catch(err){} }}
                                                 style={{ height: '100%', objectFit: 'cover', borderRadius: 6, backgroundColor: '#000', display: 'block', cursor: 'pointer' }}
                                               />
                                             ) : (
                                               <div style={{ width: '100%', height: '100%', borderRadius: 6, backgroundColor: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                                                 <PlayArrowIcon style={{ fontSize: 20 }} />
                                               </div>
                                             )}
                                           </div>

                                           {/* Moved delete button to be next to the thumbnail */}
                                           <div style={{ marginLeft: 'auto' }}>
                                             <IconButton
                                               aria-label="delete"
                                               size="small"
                                               onClick={(e) => { e.stopPropagation(); removeRecord(rec); }}
                                               disabled={deletingId === String(key)}
                                             >
                                               <DeleteIcon fontSize="small" />
                                             </IconButton>
                                           </div>

                                         </div>
                                       </div>
                                     </div>
                                  </div>
                                );
                            })}
                          </div>
                        ))}

                        {/* sentinel remains inside playlist (observer needs it inside the scrollable list) */}
                        <div ref={sentinelRef} style={{ width: '100%', height: 20 }} aria-hidden="true" />
                      </div>

                      {/* RIGHT: Main player + controls + meta */}
                      <div style={{ flex: 1, minWidth: 320 }}>
                        <div style={{ padding: 8 }}>
                           {/* Title displayed on its own row above the player */}
                          {(mainDisplayTitle) && (
                            <div style={{
                              marginBottom: 8,
                              background: 'transparent',
                              color: '#000',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              padding: '6px 10px',
                              borderRadius: 6,
                              fontSize: 14,
                              maxWidth: '100%'
                            }}>
                              <PlayArrowIcon style={{ fontSize: 18, color: '#000', flex: '0 0 auto' }} />
                              <div style={{
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                flex: '1 1 auto'
                              }}>{mainDisplayTitle}</div>
                            </div>
                          )}
                           {/* Main preview player - shows selected record or uploaded preview */}
                           <video
                             ref={videoRefMain}
                             src={mainPreviewSrc}
                             onError={(e) => {
                               try {
                                 const err = videoRefMain.current && videoRefMain.current.error;
                                 console.error('[Video] main video error event', e, err);
                               } catch (err) {}
                             }}
                             onCanPlay={() => { try { console.debug('[Video] main video canplay', { currentSrc: videoRefMain.current && videoRefMain.current.currentSrc, readyState: videoRefMain.current && videoRefMain.current.readyState }); } catch(e){} }}
                              onTimeUpdate={onTimeUpdate}
                              onLoadedMetadata={onLoadedMetadata}
                              onPlay={() => setPlayingId(selectedRecordId)}
                              onPause={() => { if (playingId === selectedRecordId) setPlayingId(null); }}
                              style={{ width: '100%', maxHeight: 420, objectFit: 'contain', borderRadius: 6, backgroundColor: '#000' }}
                              controls
                              preload="metadata"
                              playsInline
                            />
                           {debugVideo && (
                             <div style={{ marginTop: 8, padding: 8, border: '1px dashed #ccc', borderRadius: 6, fontSize: 12, background: '#fafafa' }}>
                               <div><strong>Debug (visible)</strong></div>
                               <div>selectedRecordId: {String(selectedRecordId || '')}</div>
                               <div>mainSrc (state): {String(mainSrc || '')}</div>
                               <div>uploadedVideoSrc: {String(uploadedVideoSrc || '')}</div>
                               <div>computed mainPreviewSrc: {String(mainPreviewSrc || '')}</div>
                               <div>video.currentSrc: {videoRefMain.current && videoRefMain.current.currentSrc ? String(videoRefMain.current.currentSrc) : '(not available)'}</div>
                               <div>video.readyState: {videoRefMain.current ? String(videoRefMain.current.readyState) : 'n/a'}</div>
                             </div>
                           )}
                        </div>
                       </div>
                     </div>

                     {/* Helper row placed under the two-column layout so the hint is always visible beneath the playlist */}
                     <div style={{ display: 'flex', gap: 16, marginTop: 4 }}>
                       <div style={{ width: 300, paddingLeft: 8 }}>
                         {loading ? (
                           <div style={{ fontSize: 13, color: '#666', marginTop: 6, textAlign: 'center' }}>Loading...</div>
                         ) : (hasMore && (
                           <div style={{ fontSize: 13, color: '#666', marginTop: 6, textAlign: 'center' }}>Scroll to load more</div>
                         ))}
                       </div>
                       <div style={{ flex: 1 }} />
                     </div>
                    </>
                  );
                 })()
               ) : (
                <p style={{ marginTop: 12, color: '#555' }}>{loading ? 'Loading videos...' : 'No videos yet — placeholder component.'}</p>
              )}
              {debugVideo && (
                <div style={{ marginTop: 8, padding: 8, border: '1px dashed #ccc', borderRadius: 6, fontSize: 13 }}>
                  <div style={{ marginBottom: 6 }}><strong>Debug</strong> — page: {page}, loading: {String(loading)}, hasMore: {String(hasMore)}, records: {records.length}</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Button size="small" variant="outlined" onClick={() => { handleLoadMore(); }}>Load more (debug)</Button>
                    <Button size="small" variant="text" onClick={() => { console.debug('[Video] state', { page, loading, hasMore, recordsLength: records.length, sentinelExists: !!sentinelRef.current }); }}>Log state</Button>
                  </div>
                </div>
              )}
            </div>

             {/* Modal for adding/uploading a video */}
             <Modal
                 open={isModalOpen}
                 // Do not close when user clicks the backdrop. Modal's onClose receives (event, reason).
                 onClose={(event, reason) => {
                   // ignore backdrop clicks so clicking outside the modal won't close
                   if (reason === 'backdropClick') return;
                   // allow other reasons (eg. escape key) to close
                   try { handleClose(); } catch (e) {}
                 }}
                 aria-labelledby="add-video-modal"
                 aria-describedby="upload-video"
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
                         onClick={handleCloseClick}
                         sx={{ position: 'absolute', right: 8, top: 8 }}
                     >
                         <CloseIcon />
                     </IconButton>
                     {/* Header: + Video with icon similar to the Photo modal */}
                     <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                       <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                         <VideocamOutlinedIcon fontSize="small" />
                         <strong style={{ fontSize: 18 }}>+ Video</strong>
                       </div>
                     </div>
                     <TextField
                         fullWidth
                         label="Video title"
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
                                   disabled={!videoID || (title || '').trim() === ''}
                                   size="large"
                                 >
                                   <CheckIcon />
                                 </IconButton>
                               </InputAdornment>
                             ) : null
                           )
                         }}
                     />

                     {/* generated thumbnail preview (if available) */}
                     {thumbnailSrcs && thumbnailSrcs.length > 0 && (
                       <div style={{ marginTop: 8, marginBottom: 8 }}>
                         <div style={{ fontSize: 12, color: flashPrompt ? 'orange' : '#666', marginBottom: 6 }}>Choose one of thumbnail for your video</div>
                         <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                           {thumbnailSrcs.slice(0,3).map((t, idx) => {
  // Only consider a thumbnail confirmed if we explicitly set confirmedThumbIndex or confirmedThumbUrl.
  // Do NOT treat the generated thumbnailSrc (preview) as "confirmed" — that caused the first
  // thumbnail to appear as Selected immediately.
  const isConfirmed = (confirmedThumbIndex === idx) || (confirmedThumbUrl && confirmedThumbUrl === t);
 // If a thumbnail has been confirmed, prevent selecting others
   const selectionLocked = confirmedThumbIndex !== null;
   const isActive = selectedThumbIndex === idx || confirmedThumbIndex === idx;
   return (
     <div
       key={idx}
       onClick={() => {
         // allow selecting only if no thumbnail has been confirmed
         if (selectionLocked) return;
         setSelectedThumbIndex(idx);
       }}
       style={{
         width: thumbSize.width + 'px',
         cursor: selectionLocked && !isConfirmed ? 'default' : 'pointer',
         position: 'relative',
         borderRadius: 6,
         overflow: 'hidden',
         boxShadow: isActive ? '0 0 0 3px rgba(30,136,229,0.15)' : 'none',
         opacity: selectionLocked && !isConfirmed ? 0.7 : 1
       }}
     >
      <img
        src={t}
        alt={`thumb-${idx}`}
        style={{
          width: '100%',
          height: 'auto',
          objectFit: 'cover',
          display: 'block'
        }}
      />
      {(isActive) && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none'
        }}>
          <div style={{ pointerEvents: 'auto' }}>
            <Button
              size="small"
              variant="contained"
              onClick={(e) => {
                e.stopPropagation();
                // Prevent re-upload or confirming other thumbs once one is confirmed
                if (selectionLocked && !isConfirmed) return;
                if (isConfirmed) return; // already confirmed
                uploadSelectedThumbnail(t, idx);
              }}
              disabled={isThumbUploadingModal || (selectionLocked && !isConfirmed)}
              style={{
                backgroundColor: isConfirmed ? '#e0e0e0' : undefined,
                color: isConfirmed ? '#444' : undefined,
                boxShadow: 'none',
                textTransform: 'none'
              }}
            >
              {isThumbUploadingModal ? `Uploading ${thumbUploadProgressModal || 0}%` : (isConfirmed ? 'Selected' : 'Confirm')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
})}
                         </div>
                       </div>
                     )}

                     {/* mini video player - always visible when modal open; disabled until a source is loaded */}
                     <div style={{ marginBottom: 12, padding: 8, border: '1px solid #eee', borderRadius: 6 }}>
                       <video
                         ref={videoRefModal}
                         src={uploadedVideoSrc || undefined}
                         onTimeUpdate={onTimeUpdate}
                         onLoadedMetadata={onLoadedMetadata}
                         onPlay={() => setIsPlayingModal(true)}
                         onPause={() => setIsPlayingModal(false)}
                         style={{ width: '100%', maxHeight: 240, marginTop: 8, backgroundColor: '#000' }}
                         playsInline
                         controls
                       />
                       {/* Show helper text below the video and above the DropVideo area when no video is loaded */}
                       {!uploadedVideoSrc && (
                         <div style={{ marginTop: 8, fontSize: 13, color: '#666' }}>No video loaded -drop a video below to preview</div>
                       )}
                     </div>

                     {/* DropVideo handles the drag-and-drop upload; pass createdId as compId so it can associate the file */}
                     {typeof DropVideo === 'function' ? (
                         // Constrain the drop area height and mark as presentation for accessibility
                         <div role="presentation" style={{ maxHeight: 200, height: 100, overflow: 'auto', padding: 4 }}>
                             <DropVideo
                                 type="video"
                                 folder="video"
                                 dbName={objDBName}
                                 collName="video"
                                 compId={videoID}
                                 handleError={(err) => setModalMessage(err)}
                                 onVideoUploaded={handleUploadSuccess}
                                 previewHeight="120px"
                             />
                         </div>
                     ) : (
                         <div style={{ color: 'red', padding: 8 }}>
                             Error: DropVideo component is not available. Check import/export.
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

// helper to get a usable poster/thumbnail URL from a record
function getPosterUrl(rec) {
  try {
    if (!rec) return null;
    // Prefer explicit video thumbnail fields that the backend may set on the video record
    // Try a list of common candidate keys in priority order
    const keys = [
      'videoThumbnail', 'video_thumbnail', 'video_thumb', 'videoThumb', 'videoThumbUrl',
      'poster', 'posterUrl', 'poster_url', 'thumbnail', 'thumb', 'thumbnailUrl', 'fileUrl',
      'url', 'path', 'file', 'video'
    ];

    let candidate = null;
    for (const k of keys) {
      if (candidate) break;
      if (rec.hasOwnProperty && rec.hasOwnProperty(k)) {
        candidate = rec[k];
        break;
      }
      // also check nested metadata object (some APIs place files under rec.file or rec.meta.file)
      if (rec.meta && rec.meta[k]) { candidate = rec.meta[k]; break; }
    }

    // some APIs return objects for files (eg. {path, url, fileUrl} or array)
    const normalizeCandidate = (c) => {
      if (!c) return null;
      if (typeof c === 'string' ) return c;
      if (Array.isArray(c) && c.length > 0) {
        const first = c[0];
        if (typeof first === 'string') return first;
        if (first && typeof first === 'object') return first.url || first.path || first.fileUrl || null;
        return null;
      }
      if (typeof c === 'object') {
        return c.url || c.path || c.fileUrl || c.file || c.src || null;
      }
      return null;
    };

    candidate = normalizeCandidate(candidate);
    if (!candidate) return null;
    if (typeof candidate !== 'string') return null;

    // If candidate is already an absolute URL, collapse duplicate slashes but preserve protocol (https://)
    if (candidate.startsWith('http') || candidate.startsWith('//')) {
      // collapse multiple slashes that are not part of the protocol
      return candidate.replace(/([^:])\/\/{2,}/g, '$1/');
    }

    // normalize relative paths to absolute using CDNURL or API_BASE_URL
    const base = (typeof CDNURL === 'string' && CDNURL) ? CDNURL : API_BASE_URL;
    if (!base) return candidate;
    const baseNoSlash = String(base).replace(/\/+$/g, '');
    const pathNoLeading = String(candidate).replace(/^\/+/, '');
    let out = baseNoSlash + '/' + pathNoLeading;
    // final collapse of accidental double slashes (except the protocol part) just in case
    out = out.replace(/([^:])\/\/{2,}/g, '$1/');
    return out;
  } catch (e) {
    return null;
  }
}

// helper to join base + path into a normalized absolute URL (preserves protocol and collapses duplicate slashes)
function joinUrl(base, path) {
  try {
    if (!base) return path || null;
    if (!path) return base || null;
    const b = String(base);
    const p = String(path);
    // if path already absolute, collapse accidental double slashes and return
    if (p.startsWith('http') || p.startsWith('//')) {
      return p.replace(/([^:])\/\/{2,}/g, '$1/');
    }
    // otherwise join base and path safely
    const baseNoSlash = b.replace(/\/+$/g, '');
    const pathNoLeading = p.replace(/^\/+/, '');
    let out = baseNoSlash + '/' + pathNoLeading;
    out = out.replace(/([^:])\/\/{2,}/g, '$1/');
    return out;
  } catch (e) {
    return null;
  }
}

// ensure the component is exported as default so imports like `import Video from '../Video/video'` work
export default Video;
