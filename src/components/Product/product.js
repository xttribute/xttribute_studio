import React, { useState, useEffect } from 'react';
import CategoryOutlinedIcon from '@mui/icons-material/CategoryOutlined';
import Button from '@mui/material/Button';
import Modal from '@mui/material/Modal';
import TextField from '@mui/material/TextField';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import axios from 'axios';
import useXttribute from '../Xttribute/useXttribute';
import { API_BASE_URL, objDBName,CDNURL, gensDBName } from '../../constants/apiConstants';
import CheckIcon from '@mui/icons-material/Check';
import InputAdornment from '@mui/material/InputAdornment';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import PhotoLib from '../lib/photoLib';
import VideoLib from '../lib/videoLib';
import AddIcon from '@mui/icons-material/Add';

function Product(props) {
    let isEdit = false;
    if (props && props.editable == "t") isEdit = true;

    // new state for modal and upload handling
    const { xid } = useXttribute();
    const [isModalOpen, setIsModalOpen] = useState(false);
    // persist a placeholder product record on modal open and keep its id here
    const [productID, setProductID] = useState(null);
    // Keep a ref to the placeholder id created on open so cleanup can always find it
    const placeholderIdRef = React.useRef(null);
    const [uploaded, setUploaded] = useState(false);
    const [title, setTitle] = useState('');
    // product name suffix (user-entered part). Full product title will be: `${props.name} ${productNameSuffix}`
    const [productNameSuffix, setProductNameSuffix] = useState('');
    const [isTitleConfirmed, setIsTitleConfirmed] = useState(false);
    const [confirmedFullTitle, setConfirmedFullTitle] = useState('');
    // inline test area: product description state for modal
    const [productDescription, setProductDescription] = useState('');
    const [isEditingDescription, setIsEditingDescription] = useState(false);
    const descriptionSavingRef = React.useRef(false);
    // specifications: array of {name, value}
    const [specs, setSpecs] = useState([{ name: '', value: '' }]);
    const specsSavingRef = React.useRef(false);
    // mini track player state
    const [uploadedProductSrc, setUploadedProductSrc] = useState(null);
    // separate refs for main UI audio and modal audio to avoid clobbering
    const audioRefMain = React.useRef(null);
    const audioRefModal = React.useRef(null);

    const [playingId, setPlayingId] = useState(null);
    const [currentTimes, setCurrentTimes] = useState({});
    const [durationsMap, setDurationsMap] = useState({});
	const pageSize = 8; 
    // New: store fetched product records list and pagination state
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

    // Debug flag: enable by adding ?debugProduct=1 to the URL
    const debugProduct = React.useMemo(() => {
      try { return typeof window !== 'undefined' && (new URLSearchParams(window.location.search)).get('debugProduct') === '1'; } catch (e) { return false; }
    }, []);

    // New: pending delete state to avoid window.confirm modal
    const [pendingDeleteId, setPendingDeleteId] = useState(null);
    const [deletingId, setDeletingId] = useState(null);

    // Photo picker state for modal image grid
    const [photoLibOpen, setPhotoLibOpen] = useState(false);
    const [photoLibBoxIndex, setPhotoLibBoxIndex] = useState(0);
    // local previews for the 3x3 grid
    const [productImages, setProductImages] = useState(Array(9).fill(null));

    // Video playlist / library state
    const [videoLibOpen, setVideoLibOpen] = useState(false);
    const [videoPlaylist, setVideoPlaylist] = useState([]); // array of video objects
    const [selectedVideo, setSelectedVideo] = useState(null);
    // refs to measure playlist/player so playlist can scroll when taller than player
    const videoPlaylistRef = React.useRef(null);
    const videoPlayerRef = React.useRef(null);
    // reference to the actual <video> element so we can reload/play when selection changes
    const videoElRef = React.useRef(null);

    const getVideoSource = (v) => {
      if (!v) return null;
      const candidate = v && (v.url || v.file || v.path || v.video || v.source);
      if (!candidate) return null;
      const s = String(candidate || '');
      return s.startsWith('http') ? s : (CDNURL ? (CDNURL + s) : s);
    };

    const onSelectVideoFromLib = async (video) => {
      if (!video) return;
      // enforce maximum playlist size of 5
      try {
        if ((videoPlaylist || []).length >= 5) {
          console.warn('[Product] playlist already at maximum length (5). Ignoring add request.');
          setVideoLibOpen(false);
          return;
        }
      } catch (e) {}
      // compute next available numbered video field (video1..video5) based on current playlist items
      const nextIndex = (() => {
        try {
          const used = new Set();
          (videoPlaylist || []).forEach(v => {
            try {
              if (v && v.fieldKey) {
                const m = String(v.fieldKey).match(/^video(\d+)$/i);
                if (m) used.add(Number(m[1]));
              }
            } catch (e) {}
          });
          for (let i = 1; i <= 5; i++) if (!used.has(i)) return i;
        } catch (e) {}
        return null;
      })();
      if (!nextIndex) {
        console.warn('[Product] no available video slot (max 5)');
        setVideoLibOpen(false);
        return;
      }
      const fieldKey = 'video' + nextIndex;

      // prefer the explicit 'video' field returned by the video object; fallback to other candidates
      const rawValCandidate = (video && (video.video || video.file || video.path || video.url || video.source || video._id || video.id));
      const valueForProductRaw = rawValCandidate == null ? '' : String(rawValCandidate);

      // build JSON shape to persist: { title, video, thumbnail }
      const titleVal = (video && (video.title || video.name)) ? String(video.title || video.name) : '';
      const videoVal = valueForProductRaw;
      const thumbVal = (video && (video.videoThumbnail || video.thumbnail || video.thumb)) ? String(video.videoThumbnail || video.thumbnail || video.thumb) : '';

      const objToPersist = { title: titleVal, video: videoVal, thumbnail: thumbVal };
      const jsonStringForField = JSON.stringify(objToPersist);

      // Build a normalized video object for the UI (match makeVideoObj normalization)
      const normalizedVideo = { video: videoVal, title: titleVal, videoThumbnail: thumbVal, fieldKey };

      // Optimistically update UI using the normalized object
      setVideoPlaylist(prev => [...(prev || []), normalizedVideo]);
      setSelectedVideo(normalizedVideo);
      setVideoLibOpen(false);

      // Persist to backend using product id or placeholder
      const idToUse = productID || placeholderIdRef.current;
      if (!idToUse) {
        console.debug('[Product] no product id available to persist video selection');
        return;
      }

      try {
        const safeVal = (jsonStringForField || '').replace(/'/g, "\\'");
        const payload = {
          dbName: gensDBName,
          collName: 'product',
          docContents: "{'_id':'" + idToUse + "','" + fieldKey + "':'" + safeVal + "'}",
          uKey: '_id',
          updateKey: fieldKey
        };
        const res = await axios.post(API_BASE_URL + '/editObject', payload);
        console.debug('[Product] persisted playlist video field', fieldKey, idToUse, res && res.status);

        // reflect change in local records list so product list shows the new video field (store JSON string)
        setRecords(prev => (prev || []).map(r => {
            try {
              const rid = String(r._id || r.compId || r.insertedId || '');
              if (rid === String(idToUse)) {
                const copy = { ...r };
                copy[fieldKey] = jsonStringForField;
                return copy;
              }
            } catch (e) {}
            return r;
         }));
      } catch (err) {
        console.warn('[Product] failed to persist selected video to backend', err);
      }
    };

    // Remove a video from the playlist, update UI and persist removal by clearing the numbered video field on the product
    const removeVideoFromPlaylist = async (index) => {
      try {
        // optimistic UI update: remove from local playlist
        let removed = null;
        setVideoPlaylist(prev => {
          const copy = (prev || []).slice();
          const sp = copy.splice(index, 1);
          if (sp && sp.length) removed = sp[0];
          return copy;
        });

        // keep selectedVideo sensible
        setVideoPlaylist((prev) => {
          const newSel = (prev && prev.length > 0) ? prev[0] : null;
          setSelectedVideo(newSel);
          return prev || [];
        });

        // persist removal to backend by clearing the numbered field (video1, video2...)
        const idToUse = productID || placeholderIdRef.current;
        if (!idToUse) {
          console.debug('[Product] no product id available to persist video removal for index', index);
          return;
        }
        // Prefer the actual product fieldKey stored on the playlist item. Fall back to positional.
        const fieldKey = (removed && removed.fieldKey) ? String(removed.fieldKey) : ('video' + (Number(index || 0) + 1));
        const payload = {
          dbName: gensDBName,
          collName: 'product',
          docContents: "{'_id':'" + idToUse + "','" + fieldKey + "':''}",
          uKey: '_id',
          updateKey: fieldKey
        };
        try {
          const res = await axios.post(API_BASE_URL + '/editObject', payload);
          console.debug('[Product] cleared playlist video field on backend', fieldKey, idToUse, res && res.status);
          // reflect change in local records list
          setRecords(prev => (prev || []).map(r => {
            try {
              const rid = String(r._id || r.compId || r.insertedId);
              if (rid === String(idToUse)) {
                const copy = { ...r };
                copy[fieldKey] = '';
                return copy;
              }
            } catch (e) {}
            return r;
          }));
        } catch (err) {
          console.warn('[Product] failed to persist playlist video removal to backend', err);
        }
      } catch (e) {
        console.error('[Product] removeVideoFromPlaylist error', e);
      }
    };

    const selectPlaylistVideo = (video) => {
      setSelectedVideo(video);
    };

    // When selectedVideo changes, instruct the video element to load the new source and attempt to play.
    React.useEffect(() => {
      try {
        const el = videoElRef.current;
        const src = getVideoSource(selectedVideo);
        if (!el) return;
        // If no source, ensure video is unloaded
        if (!src) {
          try { el.removeAttribute('src'); el.load(); } catch (e) {}
          return;
        }
        // Set src and reload
        try {
          // setting src attribute then load ensures the player picks up the new source
          el.src = src;
          el.load();
          // try to play - allowed because user clicked the playlist
          const p = el.play();
          if (p && typeof p.catch === 'function') p.catch(() => {});
        } catch (e) {
          // ignore play errors (autoplay blocking)
        }
      } catch (e) {}
    }, [selectedVideo]);

    // Handler to remove an image from a slot: clears UI and calls backend to remove the image field
    const handleRemoveImage = async (boxIndex) => {
      try {
        // compute field name and id
        const imageKey = 'image' + (Number(boxIndex || 0) + 1);
        const idToUse = productID || placeholderIdRef.current;
        // always clear UI immediately
        setProductImages(prev => {
          const copy = (prev || []).slice();
          copy[Number(boxIndex) || 0] = null;
          return copy;
        });

        if (!idToUse) {
          console.debug('[Product] no product id available to persist image removal for', imageKey);
          return;
        }

        // send empty value to backend to clear the field
        const payload = {
          dbName: gensDBName,
          collName: 'product',
          docContents: "{'_id':'" + idToUse + "','" + imageKey + "':''}",
          uKey: '_id',
          updateKey: imageKey
        };
        try {
          const res = await axios.post(API_BASE_URL + '/editObject', payload);
          console.debug('[Product] removed image field on backend', imageKey, idToUse, res && res.status);
          // also update local records list if present
          setRecords(prev => (prev || []).map(r => {
            try {
              const rid = String(r._id || r.compId || r.insertedId);
              if (String(idToUse) === rid) {
                const copy = { ...r };
                copy[imageKey] = '';
                return copy;
              }
            } catch (e) {}
            return r;
          }));
        } catch (err) {
          console.warn('[Product] failed to remove image field on backend', imageKey, idToUse, err);
        }
      } catch (e) {
        console.error('[Product] handleRemoveImage error', e);
      }
    };

    // Paginated fetch for product records. Can request any page; append when needed.
    const fetchProducts = async (requestedPage = 1, append = false) => {
      console.debug('[Product] fetchProducts called', { requestedPage, append, xid });
       // allow fetching even when xid is not set (fetch all products)
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
        // send xid filter when available, otherwise request all documents
        const docContents = xid ? "{'xid':'" + xid + "'}" : "{}";
        const payload = {
          dbName: gensDBName,
          collName: 'product',
		  docContents: docContents,
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
        console.warn('[Product] fetchProducts error', err);
      } finally {
        setLoading(false);
        try { fetchInFlightRef.current.delete(requestedPage); } catch(e){}
      }
    };

    // Initial load
    useEffect(() => {
      // fetch without gating on xid so component can list all products; fetchProducts will apply xid filter if present
      fetchProducts(1, false);
    }, [xid]);

    const handleLoadMore = () => {
      console.debug('[Product] handleLoadMore called', { page, loading, hasMore });
      if (!hasMore) return;
      // If any fetch is in flight, avoid starting another page to prevent multiple simultaneous page loads
      if (loading) return;
      if (fetchInFlightRef.current && fetchInFlightRef.current.size > 0) return;
      const next = page + 1;
      if (fetchInFlightRef.current && fetchInFlightRef.current.has(next)) return;
      fetchProducts(next, true).catch(()=>{});
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
            console.debug('[Product] IntersectionObserver triggered load');
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
                console.debug('[Product] window scroll fallback triggered load');
                handleLoadMore();
              }
            } catch (e) {}
         }, 150);
       };
       window.addEventListener('scroll', onScroll, { passive: true });
       return () => { window.removeEventListener('scroll', onScroll); if (timer) clearTimeout(timer); };
     }, [loading, hasMore, page, xid, userInteracted]);

    // open modal and create placeholder record so DropProduct can attach to it
    const handleOpen = async () => {
        // Reset state first
        setProductID(null);
        setUploaded(false);
        setUploadedProductSrc(null);
        setProductNameSuffix('');
        setProductDescription('');
        // Reset video playlist when adding a new product
        setVideoPlaylist([]);
        setSelectedVideo(null);
        // Reset image previews for new product
        setProductImages(Array(9).fill(null));
        // Reset specs area
        setSpecs([{ name: '', value: '' }]);

        // Reset title-related state so modal shows an empty name on open
        setIsTitleConfirmed(false);
        setConfirmedFullTitle('');
        setTitle('');

        // Create placeholder record first (include xid when available) so DropProduct receives compId immediately
        try {
            const docContents = xid ? "{'xid':'" + xid + "'}" : "{}";
            const payload = {
                "dbName": gensDBName,
                "collName": "product",
                "docContents": docContents,
                "uKey": "0"
            };
            const response = await axios.post(API_BASE_URL + '/newObject', payload);
            // store returned id for later use even if doc_201 message is not present
            if (response && response.status === 200) {
                let returnedId = response.data && (response.data._id || response.data.insertedId || response.data.compId);
                // normalize empty-string -> null
                if (typeof returnedId === 'string') returnedId = returnedId.trim() || null;
                // store both in state and ref for reliable cleanup
                placeholderIdRef.current = returnedId || null;
                console.debug('[Product] newObject returned id (stored in ref):', placeholderIdRef.current, response.data);
                setProductID(returnedId || null);
            }
        } catch (err) {
            console.error('[Product] error creating placeholder product record', err);
        }

        // Open modal after attempting to create the record
        setIsModalOpen(true);
    };

    // close modal; if placeholder was created and no upload happened, remove it
    const handleClose = async () => {
        try {
            // prefer explicit productID, otherwise fallback to the placeholder ref
            const idToCheck = productID || placeholderIdRef.current;
            // Determine whether the user actually provided a product name.
            // Consider a name "set" only if the title was explicitly confirmed OR a non-empty user-entered suffix exists.
            const userSuffix = (productNameSuffix || '').toString().trim();
            const hasExplicitConfirmedTitle = Boolean(isTitleConfirmed || (confirmedFullTitle && String(confirmedFullTitle).trim()));
            const hasUserProvidedSuffix = Boolean(userSuffix);
            const hasUserTitle = hasExplicitConfirmedTitle || hasUserProvidedSuffix;

            if (idToCheck) {
                if (!hasUserTitle) {
                    const payload = {
                        dbName: gensDBName,
                        collName: 'product',
                        docContents: "{'_id':'" + idToCheck + "'}",
                        uKey: '_id'
                    };
                    try {
                        const r = await axios.post(API_BASE_URL + '/removeObject', payload);
                        console.debug('[Product] removed placeholder product record because no title was set on close', idToCheck, r && r.status);
                    } catch (e) {
                        console.warn('[Product] failed to remove placeholder', idToCheck, e);
                    }
                } else {
                    console.debug('[Product] preserving placeholder product record because a title exists or user provided a suffix');
                }
                // clear stored placeholder id reference
                placeholderIdRef.current = null;
            } else if (xid) {
                // No product id available - attempt to cleanup recent orphan placeholders for this xid
                try {
                    const payload = {
                        dbName: gensDBName,
                        collName: 'product',
                        docContents: "{'xid':'" + xid + "'}",
                        operator: 'none',
                        returnType: 'list',
                        sortBy: '_id',
                        order: 'DESC',
                        limit: 20
                    };
                    const res = await axios.post(API_BASE_URL + `/getObjects?page=1`, payload);
                    if (res && res.status === 200 && res.data) {
                        const arr = Array.isArray(res.data) ? res.data : (res.data.objects || res.data.docs || []);
                        const now = Date.now();
                        const tenMin = 10 * 60 * 1000;
                        for (const doc of (arr || [])) {
                            try {
                                const titleVal = (doc && (doc.title || '') || '').toString().trim();
                                if (titleVal) continue; // skip docs with title
                                // derive creation time from createdAt or ObjectId
                                let createdAt = null;
                                if (doc && doc.createdAt) {
                                    const t = Date.parse(doc.createdAt);
                                    if (!isNaN(t)) createdAt = t;
                                }
                                let docIdStr = '';
                                if (doc && doc._id) {
                                    if (typeof doc._id === 'string') docIdStr = doc._id;
                                    else if (typeof doc._id === 'object' && doc._id.$oid) docIdStr = doc._id.$oid;
                                }
                                if (!createdAt && docIdStr && docIdStr.length >= 8) {
                                    const ts = parseInt(docIdStr.substring(0, 8), 16) * 1000;
                                    if (!isNaN(ts)) createdAt = ts;
                                }
                                if (createdAt && (now - createdAt) <= tenMin) {
                                    const rem = {
                                        dbName: gensDBName,
                                        collName: 'product',
                                        docContents: "{'_id':'" + (docIdStr || '') + "'}",
                                        uKey: '_id'
                                    };
                                    try {
                                        const r2 = await axios.post(API_BASE_URL + '/removeObject', rem);
                                        console.debug('[Product] removed recent orphan placeholder', docIdStr, r2 && r2.status);
                                    } catch (e) {
                                        console.warn('[Product] failed to remove orphan', docIdStr, e);
                                    }
                                }
                            } catch (e) { /* ignore per-doc errors */ }
                        }
                    }
                } catch (e) {
                    console.warn('[Product] cleanup fetch failed', e);
                }
            }
        } catch (err) {
            console.log('[Product] failed to cleanup created record on close', err);
        }
        setIsModalOpen(false);
        setProductID(null);
        setProductNameSuffix('');
    };

    // send title update to backend
    const handleTitleConfirm = async () => {
      if (!productID) return;
      const userSuffix = (productNameSuffix || '').trim();
      // Build full title: prefix with xttribute title as available
      const prefix = (props && props.name) ? String(props.name).trim() : '';
      const fullTitle = prefix ? (prefix + (userSuffix ? ' ' + userSuffix : '')) : userSuffix;
      if (!fullTitle) return;
      // escape single quotes
      const safeTitle = fullTitle.replace(/'/g, "\\'");
      const payload = {
        dbName: gensDBName,
        collName: 'product',
        docContents: "{'_id':'" + productID + "','title':'" + safeTitle + "'}",
        uKey: '_id',
        updateKey: 'title'
      };
      try {
        const res = await axios.post(API_BASE_URL + '/editObject', payload);
        if (res && (res.status === 200 || res.status === 204)) {
          // update local list and close modal
          setRecords(prev => (prev || []).map(r => {
            if (String(r._id) === String(productID)) return { ...r, title: fullTitle };
            return r;
          }));
          // If backend returns confirmation doc_202 === 'Document updated', mark title confirmed
          try {
            if (res.data && res.data.doc_202 === 'Document updated') {
              setIsTitleConfirmed(true);
              setConfirmedFullTitle(fullTitle);
            }
          } catch (e) {}
        } else {
          console.warn('[Product] editObject unexpected response', res);
        }
      } catch (err) {
        console.error('[Product] failed to update title', err);
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
    
    // Open the add-product modal pre-filled with an existing product for editing
    const openEditModal = (rec) => {
      try {
        if (!rec) return;
        const id = rec._id || rec.compId || rec.insertedId || null;
        const idStr = id ? String(id) : null;
        // set product id and clear placeholder ref (we are editing an existing record)
        setProductID(idStr);
        placeholderIdRef.current = null;

        // title handling: try to extract suffix if props.name prefix exists
        const fullTitle = (rec && (rec.title || rec.name)) ? String(rec.title || rec.name) : '';
        const prefix = (props && props.name) ? String(props.name).trim() : '';
        if (fullTitle) {
          setIsTitleConfirmed(true);
          setConfirmedFullTitle(fullTitle);
          if (prefix && fullTitle.startsWith(prefix)) {
            const suffix = fullTitle.substring(prefix.length).trim();
            setProductNameSuffix(suffix);
          } else {
            // if no prefix, show the full title as suffix for editing convenience
            setProductNameSuffix(fullTitle);
          }
        } else {
          setIsTitleConfirmed(false);
          setConfirmedFullTitle('');
          setProductNameSuffix('');
        }

        // description
        setProductDescription((rec && (rec.description || '')) || '');

        // specs: handle object or JSON string -> convert to array rows, always leave trailing empty row
        try {
          const s = rec && rec.specs;
          let specsObj = null;
          if (!s) {
            specsObj = {};
          } else if (typeof s === 'string') {
            try { specsObj = JSON.parse(s); } catch (e) { specsObj = {}; }
          } else if (typeof s === 'object') {
            specsObj = s;
          } else {
            specsObj = {};
          }
          const specsArr = [];
          Object.keys(specsObj || {}).forEach(k => { try { specsArr.push({ name: k, value: String((specsObj || {})[k] || '') }); } catch(e){} });
          if (specsArr.length === 0) specsArr.push({ name: '', value: '' });
          else specsArr.push({ name: '', value: '' });
          setSpecs(specsArr);
        } catch (e) {
          setSpecs([{ name: '', value: '' }]);
        }

        // images: collect image1..image9 or fallback fields into a 9-slot array for modal previews
        try {
          const imgs = Array.from({ length: 9 }).map((_, i) => {
            const key = 'image' + (i + 1);
            let val = rec && (rec[key] || null);
            if (!val && i === 0) {
              // fallback common fields
              val = rec && (rec.image1 || rec.image || rec.photo || rec.thumb || null);
            }
            if (!val) return null;
            const sVal = String(val || '');
            // keep absolute urls as-is, otherwise with CDNURL if available for preview
            if (sVal.startsWith('http')) return sVal;
            return CDNURL ? (CDNURL + sVal) : sVal;
          });
          setProductImages(imgs);
        } catch (e) {
          setProductImages(Array(9).fill(null));
        }

        // --- NEW: populate video playlist and selected video when editing an existing record ---
        try {
          const makeVideoObj = (raw) => {
            if (!raw) return null;
            // if already an object with useful fields, normalize and return
            if (typeof raw === 'object') {
              const v = {};
              // normalize video source field
              v.video = raw.video || raw.url || raw.file || raw.path || raw.source || '';
              // normalize title
              v.title = raw.title || raw.name || '';
              // normalize thumbnail: accept videoThumbnail, thumbnail, or thumb
              v.videoThumbnail = raw.videoThumbnail || raw.thumbnail || raw.thumb || '';
              // preserve original id if present
              if (raw._id) v._id = raw._id;
              if (raw.id) v.id = raw.id;
              return v;
            }
            // otherwise create a simple object wrapper so UI can use video/videoThumbnail/title
            return { video: String(raw), title: String(raw), videoThumbnail: '' };
          };

          let playlist = [];
          // 1) if record has an explicit array of videos (common name: videos or videoPlaylist)
          if (rec && Array.isArray(rec.videos) && rec.videos.length > 0) {
            playlist = rec.videos.map(v => makeVideoObj(v)).filter(Boolean);
          } else if (rec && Array.isArray(rec.videoPlaylist) && rec.videoPlaylist.length > 0) {
            playlist = rec.videoPlaylist.map(v => makeVideoObj(v)).filter(Boolean);
          } else if (rec && rec.videos && typeof rec.videos === 'string') {
            // JSON-encoded array stored as string
            try {
              const parsed = JSON.parse(rec.videos);
              if (Array.isArray(parsed)) playlist = parsed.map(v => makeVideoObj(v)).filter(Boolean);
            } catch (e) { /* ignore parse errors */ }
          } else if (rec && rec.videoPlaylist && typeof rec.videoPlaylist === 'string') {
            try {
              const parsed = JSON.parse(rec.videoPlaylist);
              if (Array.isArray(parsed)) playlist = parsed.map(v => makeVideoObj(v)).filter(Boolean);
            } catch (e) { /* ignore parse errors */ }
          }

          // 2) fallback: look for numbered fields video1, video2, ... and collect in order
          if (playlist.length === 0 && rec) {
            const numbered = [];
            Object.keys(rec || {}).forEach(k => {
              const m = k.match(/^video(\d+)$/i);
              if (m) {
                try {
                  // attempt to parse JSON-encoded video objects stored as strings
                  let val = rec[k];
                  if (typeof val === 'string') {
                    const s = val.trim();
                    if (s.startsWith('{') || s.startsWith('[')) {
                      try { val = JSON.parse(s); } catch (e) { /* keep original string if parse fails */ }
                    }
                  }
                  numbered.push({ idx: Number(m[1]), val: val, fieldKey: k });
                } catch (e) {}
              }
            });
            if (numbered.length > 0) {
              numbered.sort((a, b) => a.idx - b.idx);
              // preserve the originating product field (videoN) so delete can clear the correct field
              playlist = numbered.map(n => {
                const v = makeVideoObj(n.val);
                if (!v) return null;
                try { v.fieldKey = n.fieldKey || ('video' + n.idx); } catch (e) {}
                return v;
              }).filter(Boolean);
            }
          }

          // 3) final fallback: single 'video' field
          if (playlist.length === 0 && rec && rec.video) {
            playlist = [ makeVideoObj(rec.video) ].filter(Boolean);
          }

          // ensure we have an array and set state
          if (playlist.length > 0) {
            // cap to maximum 5 videos
            const capped = (playlist || []).slice(0, 5);
            setVideoPlaylist(capped);
            // pick the first as selected by default
            setSelectedVideo(capped[0] || null);
          } else {
            setVideoPlaylist([]);
            setSelectedVideo(null);
          }
        } catch (e) {
          // if anything goes wrong, ensure UI doesn't break
          setVideoPlaylist([]);
          setSelectedVideo(null);
        }

        // open modal
        setIsModalOpen(true);
      } catch (e) {
        console.error('[Product] openEditModal error', e);
      }
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
        dbName: gensDBName,
        collName: 'product',
        docContents: "{'_id':'" + recId + "','title':'" + safeTitle + "'}",
        uKey: '_id',
        updateKey: 'title'
      };
      try {
        const res = await axios.post(API_BASE_URL + '/editObject', payload);
        if (res && (res.status === 200 || res.status === 204)) {
          // update local list
          setRecords(prev => (prev || []).map((r) => {
            if (String(r._id || r.compId || r.insertedId) === String(recId)) {
              return { ...r, title: trimmed };
            }
            return r;
          }));
          cancelEditRecord();
        } else {
          console.warn('[Product] editObject unexpected response', res);
        }
      } catch (err) {
        console.error('[Product] failed to update title (inline)', err);
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
        dbName: gensDBName,
        collName: 'product',
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
          setRecords(prev => (prev || []).filter((r) => String(r._id || r.compId || r.insertedId) !== key));
          if (playingId === key) setPlayingId(null);
        } else {
          console.warn('[Product] removeObject unexpected response', res);
        }
      } catch (err) {
        console.error('[Product] failed to remove record', err);
      } finally {
        setDeletingId(null);
        setPendingDeleteId(null);
      }
    };

    // save product description to backend (inline test area)
    const saveProductDescription = async () => {
      if (descriptionSavingRef.current) return;
      const id = productID || placeholderIdRef.current;
      if (!id) {
        // nothing to save to yet
        setIsEditingDescription(false);
        return;
      }
      descriptionSavingRef.current = true;
      try {
        const safeVal = (productDescription || '').replace(/'/g, "\\'");
        const payload = {
          dbName: gensDBName,
          collName: 'product',
          docContents: "{'_id':'" + id + "','description':'" + safeVal + "'}",
          uKey: '_id',
          updateKey: 'description'
        };
        const res = await axios.post(API_BASE_URL + '/editObject', payload);
        if (res && (res.status === 200 || res.status === 204)) {
          // reflect change in local records list
          setRecords(prev => (prev || []).map(r => {
            try {
              const rid = String(r._id || r.compId || r.insertedId);
              if (rid === String(id)) return { ...r, description: productDescription };
            } catch (e) {}
            return r;
          }));
          setIsEditingDescription(false);
        } else {
          console.warn('[Product] editObject unexpected response for description', res);
        }
      } catch (e) {
        console.error('[Product] failed to save description', e);
      } finally {
        descriptionSavingRef.current = false;
      }
    };

    // SPEC HANDLERS
    const handleSpecChange = (index, field, val) => {
      setSpecs(prev => {
        const copy = (prev || []).slice();
        copy[index] = { ...(copy[index] || { name: '', value: '' }), [field]: val };
        // if last row has some content, append a new empty row
        const last = copy[copy.length - 1];
        if (last && (String(last.name || '').trim() !== '' || String(last.value || '').trim() !== '')) {
          copy.push({ name: '', value: '' });
        }
        return copy;
      });
    };

    const removeSpecAt = (index) => {
      setSpecs(prev => {
        const copy = (prev || []).slice();
        copy.splice(index, 1);
        if (copy.length === 0) copy.push({ name: '', value: '' });
        return copy;
      });
    };

    const saveSpecs = async () => {
      if (specsSavingRef.current) return;
      const id = productID || placeholderIdRef.current;
      if (!id) return;
      specsSavingRef.current = true;
      try {
        // Build object mapping specName -> specValue, ignoring empty rows
        const obj = {};
        (specs || []).forEach(s => {
          try {
            const n = String((s && s.name) || '').trim();
            const v = String((s && s.value) || '').trim();
            if (n !== '') obj[n] = v;
          } catch (e) {}
        });
        const jsonVal = JSON.stringify(obj);
        const safeJson = jsonVal.replace(/'/g, "\\'");
        const payload = {
          dbName: gensDBName,
          collName: 'product',
          docContents: "{'_id':'" + id + "','specs':'" + safeJson + "'}",
          uKey: '_id',
          updateKey: 'specs'
        };
        const res = await axios.post(API_BASE_URL + '/editObject', payload);
        if (res && (res.status === 200 || res.status === 204)) {
          // reflect change in local records list (store object mapping)
          setRecords(prev => (prev || []).map(r => {
            try {
              const rid = String(r._id || r.compId || r.insertedId);
              if (rid === String(id)) return { ...r, specs: obj };
            } catch (e) {}
            return r;
          }));
        } else {
          console.warn('[Product] editObject unexpected response for specs', res);
        }
      } catch (e) {
        console.error('[Product] failed to save specs', e);
      } finally {
        specsSavingRef.current = false;
      }
     };

    return (
        <div style={{ padding: 16 }}>
            {isEdit && (
                <div className="addButton">
                    <Button className="button-8 add-button-plain" endIcon={<CategoryOutlinedIcon fontSize="small" />} onClick={handleOpen} variant="text" disableElevation disableRipple>
                        + Product
                    </Button>
                </div>
            )}
        
           

             {/* Modal for adding/uploading a product */}
             <Modal
                 open={isModalOpen}
                 onClose={(event, reason) => {
                     // Prevent closing when user clicks the backdrop. Allow other close reasons (e.g. escapeKeyDown).
                     if (reason === 'backdropClick') return;
                     handleClose(event, reason);
                 }}
                 aria-labelledby="add-product-modal"
                 aria-describedby="upload-product"
             >
                {/* Modal requires a single child element; render a Box container with product name input */}
                <Box sx={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    bgcolor: 'background.paper',
                    boxShadow: 24,
                    p: 2,
                    width: '80vw',
                    maxWidth: '1200px'
                }} onClick={(e) => e.stopPropagation()}>
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8}}>
                        <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
                            <CategoryOutlinedIcon fontSize="small" />
                            <div style={{fontWeight: 600}}>+ Product</div>
                        </div>
                        <IconButton size="small" onClick={handleClose} aria-label="close-modal">
                            <CloseIcon fontSize="small" />
                        </IconButton>
                    </div>
                    {/* Inline input: start adornment shows the xttribute title as prefix and end adornment shows confirm check */}
                    <div style={{display: 'flex', gap: 8, alignItems: 'center'}}>
                        {/* compute preview title to decide if confirm should be enabled */}
                        {/* eslint-disable-next-line no-unused-vars */}
                        {null}
                        {isTitleConfirmed ? (
                            <TextField
                                fullWidth
                                variant="outlined"
                                size="small"
                                value={confirmedFullTitle}
                                disabled
                                InputProps={{
                                    endAdornment: (
                                        <InputAdornment position="end">
                                            <IconButton size="small" onClick={() => {
                                                // switch back to edit mode
                                                setIsTitleConfirmed(false);
                                                // try to restore suffix portion for continued editing
                                                const prefix = (props && props.name) ? String(props.name).trim() : '';
                                                if (prefix && confirmedFullTitle.startsWith(prefix)) {
                                                    const suffix = confirmedFullTitle.substring(prefix.length).trim();
                                                    setProductNameSuffix(suffix);
                                                } else {
                                                    setProductNameSuffix(confirmedFullTitle || '');
                                                }
                                            }} aria-label="edit-product-name">
                                                <EditIcon fontSize="small" />
                                            </IconButton>
                                        </InputAdornment>
                                    )
                                }}
                            />
                        ) : (
                            <TextField
                                fullWidth
                                variant="outlined"
                                size="small"
                                placeholder="Product name"
                                value={productNameSuffix}
                                onChange={(e) => setProductNameSuffix(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') handleTitleConfirm(); }}
                                InputProps={{
                                    startAdornment: (props && props.name) ? (
                                        <InputAdornment position="start">{props.name}</InputAdornment>
                                    ) : null,
                                    endAdornment: (
                                        <InputAdornment position="end">
                                            <IconButton size="small" onClick={handleTitleConfirm} aria-label="confirm-product-name" disabled={(() => {
                                                const prefix = (props && props.name) ? String(props.name).trim() : '';
                                                const userSuffix = (productNameSuffix || '').trim();
                                                const fullTitle = prefix ? (prefix + (userSuffix ? ' ' + userSuffix : '')) : userSuffix;
                                                return !fullTitle;
                                            })()}>
                                                <CheckIcon fontSize="small" />
                                            </IconButton>
                                        </InputAdornment>
                                    )
                                }}
                            />
                        )}
                    </div>

                    {/* New layout: left 50% = 3x3 product image grid, right 50% = upload / meta area */}
                    <div style={{display: 'flex', gap: 16, marginTop: 12, alignItems: 'flex-start'}}>
                      {/* LEFT: Image grid taking 50% of modal width */}
                      <div style={{width: '50%'}}>
                        <div style={{border: '1px solid #e0e0e0', padding: 8, borderRadius: 6, background: '#fafafa'}}>
                          <div style={{fontSize: 13, marginBottom: 8, fontWeight: 600}}>Photos</div>
                          <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8}}>
                            {Array.from({length:9}).map((_, idx) => (
                              <div key={idx} onClick={() => {
                                // open photo library to choose image for this slot
                                setPhotoLibBoxIndex(idx);
                                setPhotoLibOpen(true);
                              }} style={{position: 'relative', width: '100%', paddingTop: '100%', background: '#fff', border: '1px dashed #ddd', borderRadius: 4, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'}}>
                                {/* show preview if available */}
                                {productImages[idx] ? (
                                  <>
                                  <img src={productImages[idx]} alt={`img-${idx+1}`} style={{position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover'}} />
                                  {/* remove button in top-right corner */}
                                  <button aria-label={`remove-image-${idx}`} onClick={(e) => { e.stopPropagation(); handleRemoveImage(idx); }} style={{position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', borderRadius: 12, width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 5}}>
                                    <span style={{fontSize: 12, lineHeight: 1}}>×</span>
                                  </button>
                                  </>
                                ) : (
                                  <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999', fontSize: 18}}>+</div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* RIGHT: reserved area for upload controls / preview - takes remaining 50% */}
                      <div style={{width: '50%'}}>
                        {/* TOP: inline edit test area for product description (takes ~50% of right column) */}
                        <div style={{border: '1px solid #e0e0e0', padding: 8, borderRadius: 6, background: '#fafafa', minHeight: 120, marginBottom: 12}}>
                          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8}}>
                            <div style={{fontSize: 13, fontWeight: 600}}>Description</div>
                            <div>
                              {isEditingDescription ? (
                                <IconButton size="small" onClick={saveProductDescription} aria-label="save-description" disabled={descriptionSavingRef.current}>
                                  <CheckIcon fontSize="small" />
                                </IconButton>
                              ) : (
                                <IconButton size="small" onClick={() => setIsEditingDescription(true)} aria-label="edit-description">
                                  <EditIcon fontSize="small" />
                                </IconButton>
                              )}
                            </div>
                          </div>
                          <TextField
                            fullWidth
                            multiline
                            minRows={3}
                            maxRows={8}
                            variant="outlined"
                            size="small"
                            placeholder="Add a brief product description"
                            value={productDescription}
                            onChange={(e) => setProductDescription(e.target.value)}
                            disabled={!isEditingDescription}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                                // Ctrl/Cmd+Enter saves
                                saveProductDescription();
                              }
                            }}
                          />
                        </div>

                        {/* SPECS: inline editable specification list (below description) */}
                        <div style={{border: '1px solid #e0e0e0', padding: 8, borderRadius: 6, background: '#fff', minHeight: 120, marginBottom: 12}}>
                          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8}}>
                            <div style={{fontSize: 13, fontWeight: 600}}>Specifications</div>
                            <div>
                              <IconButton size="small" onClick={saveSpecs} aria-label="save-specs" disabled={specsSavingRef.current}>
                                <CheckIcon fontSize="small" />
                              </IconButton>
                            </div>
                          </div>
                          {/* Make the list scrollable when it grows tall (e.g. > ~7 rows) */}
                          <div style={{display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 360, overflowY: 'auto', paddingRight: 8}}>
                            {(specs || []).map((s, i) => (
                              <div key={i} style={{display: 'flex', gap: 8, alignItems: 'center'}}>
                                <TextField placeholder="Spec name" size="small" variant="outlined" value={s.name || ''} onChange={(e) => handleSpecChange(i, 'name', e.target.value)} style={{flex: 1}} />
                                <TextField placeholder="Spec value" size="small" variant="outlined" value={s.value || ''} onChange={(e) => handleSpecChange(i, 'value', e.target.value)} style={{flex: 1}} />
                                <IconButton size="small" onClick={() => removeSpecAt(i)} aria-label={`remove-spec-${i}`}>
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* BOTTOM: upload area placeholder removed */}
                       </div>
                    </div>

                    {/* Add a video area under the photos section in the modal */}
                    <div style={{border: '1px solid #e0e0e0', padding: 8, borderRadius: 6, background: '#fafafa', marginTop: 16}}>
                      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8}}>
                        <div style={{fontSize:13, fontWeight:600}}>Videos</div>
                        <div>
                          <IconButton size="small" onClick={() => setVideoLibOpen(true)} aria-label="add-video" disabled={(videoPlaylist || []).length >= 5} title={(videoPlaylist || []).length >= 5 ? 'Maximum 5 videos' : 'Add video'}>
                            <AddIcon fontSize="small"/>
                          </IconButton>
                        </div>
                      </div>
                      <div style={{display: 'flex', gap: 16}}>
                        {/* LEFT: Playlist */}
                        <div style={{width: '50%'}}>
                          <div ref={videoPlaylistRef} style={{border: '1px solid #ddd', borderRadius: 4, padding: 8, background: '#fff', minHeight: 160, maxHeight: '300px', overflowY: 'auto'}}>
                            <div style={{fontSize: 12, fontWeight: 600, marginBottom: 8}}>{''}</div>
                            <div style={{display:'flex', flexDirection:'column', gap:8}}>
                              {(videoPlaylist || []).map((video, idx) => {
                                // use the canonical videoThumbnail field and always prefix with CDNURL
                                const thumbCandidate = (video && (video.videoThumbnail || video.thumbnail || video.thumb)) ? String(video.videoThumbnail || video.thumbnail || video.thumb) : null;
                                const thumbUrl = thumbCandidate ? (thumbCandidate.startsWith('http') ? thumbCandidate : (CDNURL ? (CDNURL + thumbCandidate) : thumbCandidate)) : null;
                                const title = (video && (video.title || video.name)) ? String(video.title || video.name) : 'Untitled';
                                return (
                                  <div key={idx} style={{display:'flex', alignItems:'stretch', gap:8, padding:'6px', borderRadius:4, cursor:'pointer', background: selectedVideo === video ? '#f0f7ff' : 'transparent'}} onClick={() => selectPlaylistVideo(video)}>
                                    {/* thumbnail: fixed-width flex item with aspect ratio */}
                                    <div style={{flex:'0 0 168px', width:168, aspectRatio:'16/9', height:'auto', background:'#f5f5f5', borderRadius:4, overflow:'hidden', display:'block'}}>
                                      {thumbUrl ? (<img src={thumbUrl} alt={title} style={{width:'100%', height:'100%', objectFit:'cover', display:'block'}}/>) : (<div style={{color:'#999', fontSize:12}}>No thumb</div>)}
                                    </div>
                                    {/* title area stretches to thumbnail height and centers content vertically */}
                                    <div style={{flex:1, minWidth:0, display:'flex', alignItems:'center', paddingLeft:8, fontSize:12, color:'#333', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}} title={title}>{title}</div>
                                    <div style={{display:'flex', gap:6, alignItems:'center'}}>
                                      <IconButton size="small" onClick={(e) => { e.stopPropagation(); removeVideoFromPlaylist(idx); }} aria-label={`remove-video-${idx}`}>
                                        <DeleteIcon fontSize="small" />
                                      </IconButton>
                                    </div>
                                  </div>
                                );
                              })}
                              {(videoPlaylist || []).length === 0 && (<div style={{color:'#999', fontSize:12}}>No videos. Click + to add.</div>)}
                              {(videoPlaylist || []).length >= 5 && (<div style={{color:'#b00', fontSize:12, marginTop:6}}>Maximum of 5 videos reached</div>)}
                            </div>
                          </div>
                        </div>

                        {/* RIGHT: Player */}
                        <div style={{width:'50%'}}>
                          <div ref={videoPlayerRef} style={{border: '1px solid #ddd', borderRadius: 4, padding: 8, background: '#fff', minHeight: 160}}>
                            <div style={{fontSize: 12, fontWeight: 600, marginBottom: 8}}>{''}</div>
                            {selectedVideo ? (
                              <div>
                                <video ref={videoElRef} controls style={{width:'100%', borderRadius:4, maxHeight: '300px', height: 'auto', display: 'block', objectFit: 'contain'}} src={getVideoSource(selectedVideo)}>
                                  Your browser does not support the video tag.
                                </video>
                              </div>
                            ) : (
                              <div style={{fontSize:12, color:'#999', textAlign:'center'}}>Select a video or add one from the video library.</div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Video library modal */}
                    <VideoLib open={videoLibOpen} onClose={() => setVideoLibOpen(false)} xid={xid} onSelect={onSelectVideoFromLib} />
                    </Box>
              </Modal>
              {/* Photo library modal used to pick images for grid slots */}
              <PhotoLib
                open={photoLibOpen}
                onClose={() => setPhotoLibOpen(false)}
                xid={xid}
                productID={productID}
                boxIndex={photoLibBoxIndex}
                onUpdated={async ({ boxIndex, photo, photoValue, rawVal }) => {
                  try {
                    // Use CDN-prefixed photoValue for preview in the grid
                    const preview = photoValue || (photo && (photo.photo || photo.url || photo.path || String(photo._id)));
                    setProductImages(prev => {
                      const copy = (prev || []).slice();
                      copy[Number(boxIndex) || 0] = preview;
                      return copy;
                    });

                    // Update product record with the RAW photo value (no CDN)
                    if (productID) {
                      const imageKey = 'image' + (Number(boxIndex || 0) + 1);
                      const valueForProduct = rawVal || (photo && (photo.photo || photo.url || photo.path || String(photo._id)));
                      try {
                        const safeVal = (valueForProduct || '').toString().replace(/'/g, "\\'");
                        const payload = {
                          dbName: gensDBName,
                          collName: 'product',
                          docContents: "{'_id':'" + productID + "','" + imageKey + "':'" + safeVal + "'}",
                          uKey: '_id',
                          updateKey: imageKey
                        };
                        const res = await axios.post(API_BASE_URL + '/editObject', payload);
                        console.debug('[Product] updated image field on backend', imageKey, productID, res && res.status);
                        // reflect change in local records list
                        setRecords(prev => (prev || []).map(r => {
                          try {
                            const rid = String(r._id || r.compId || r.insertedId);
                            if (rid === String(productID)) {
                              const copy = { ...r };
                              copy[imageKey] = valueForProduct;
                              return copy;
                            }
                          } catch (e) {}
                          return r;
                        }));
                      } catch (e) {
                        console.warn('[Product] failed to persist selected photo', e);
                      }
                    }
                  } catch (e) {
                    console.error('[Product] PhotoLib onUpdated handler error', e);
                  } finally {
                    setPhotoLibOpen(false);
                  }
                }}
              />

              {/* --- Product list (restored) --- */}
              <div style={{marginTop:18}}>
                
                <div style={{display:'flex', flexDirection:'column', gap:8}}>
                  {(records || []).map((rec) => {
                    const id = String(rec._id || rec.compId || rec.insertedId || '');
                    const img = rec && (rec.image1 || rec.image || rec.thumb || null);
                    const imgUrl = img ? (String(img).startsWith('http') ? img : (CDNURL ? (CDNURL + img) : img)) : null;
                    return (
                      <div key={id} style={{display:'flex', alignItems:'center', gap:12, padding:8, border:'1px solid #eee', borderRadius:6, background:'#fff'}}>
                        <div style={{width:64, height:64, background:'#f7f7f7', borderRadius:4, overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center'}}>
                          {imgUrl ? <img src={imgUrl} alt={rec.title || 'img'} style={{width:'100%', height:'100%', objectFit:'cover'}}/> : <div style={{color:'#999', fontSize:12}}>No image</div>}
                        </div>
                        <div style={{flex:1, minWidth:0}}>
                          <div style={{fontWeight:600, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{rec.title || rec.name || 'Untitled'}</div>
                          <div style={{fontSize:12, color:'#666'}}>{rec.description ? (String(rec.description).substring(0,120) + (String(rec.description).length>120 ? '...' : '')) : ''}</div>
                        </div>
                        <div style={{display:'flex', gap:8, alignItems:'center'}}>
                          {/* icon-only edit/delete (dark gray) */}
                          <IconButton size="small" onClick={() => openEditModal(rec)} aria-label="edit-product" style={{color:'#555'}}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                          {pendingDeleteId === id ? (
                            <div style={{display:'flex', gap:6}}>
                              <Button size="small" color="error" onClick={() => performDelete(rec)}>Confirm</Button>
                              <Button size="small" onClick={cancelDelete}>Cancel</Button>
                            </div>
                          ) : (
                            <IconButton size="small" onClick={() => removeRecord(rec)} aria-label="delete-product" style={{color:'#555'}}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* sentinel for infinite scroll */}
                <div ref={sentinelRef} style={{height:1}} />
              </div>

            </div>
        );
}

export default Product;
