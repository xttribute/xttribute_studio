import React, {useState,useRef,useEffect} from 'react';
import Editable from '../InlineEdit/Editable';
import {API_BASE_URL, objDBName, CDNURL} from '../../constants/apiConstants';
import axios from 'axios';
import './Photo.css';
import '../common.css';
import Button from '@mui/material/Button';
import 'react-resizable/css/styles.css';
import useXttribute from '../Xttribute/useXttribute';
import DeleteIcon from '@mui/icons-material/Delete';
import IconButton from '@mui/material/IconButton';
import SuccessMessage from '../AlertComponent/SuccessMessage';
import useUserSession from '../User/useUserSession';
import Photos from './Photos';
import PhotoLibraryOutlinedIcon from '@mui/icons-material/PhotoLibraryOutlined';
import CloseIcon from '@mui/icons-material/Close';
import CheckIcon from '@mui/icons-material/Check';
import { Resizable, ResizableBox } from "react-resizable";
import DropPhoto from './DropPhoto';
import {Row, Col} from 'reactstrap';
import { useLocation } from 'react-router-dom';
import Modal from '@mui/material/Modal';

function Photo(props) {
	const {xid} = useXttribute();
	const {xuid} = useXttribute();
	const {uid} = useUserSession();
	const location = useLocation();
	const [state, setState] = useState({
			sMessage: null
		})
	const [modalMessage, setModalMessage] = useState(null);
	const [iValues, setIValues] = useState({})
	const [photos, setPhotos] =useState([]);
	const[records, setRecords] =useState([]);
	const [page, setPage] = useState(1); // Track current page
	const pageRef = useRef(1);
	const [loading, setLoading] = useState(false); // Track loading state
	const [hasMore, setHasMore] = useState(true); // Track if more photos exist
	const photoListRef = useRef(null); // Ref for photo list container
	const loadingRef = useRef(loading);
	// sentinel and observer refs
	const sentinelRef = useRef(null);
	const observerRef = useRef(null);
	const requestedPagesRef = useRef(null);
	const userInteractedRef = useRef(false);
	// queue a user intent that happens before the initial load completes
	const queuedUserIntentRef = useRef(false);
	const initialLoadCompletedRef = useRef(false);
	const initialLoadTimeRef = useRef(0);
	const timerRef = useRef(null);
	const [lastFetchedCount, setLastFetchedCount] = useState(0);
	const PAGE_LIMIT = 8; // page size used by API
	const attachObserverRef = useRef(null);
	// Suppress auto-loading of subsequent pages immediately after navigation/initial load
	const suppressAutoRef = useRef(false);
	const initialSuppressTimerRef = useRef(null);
	// Track whether we're still processing the navigation-triggered initial load
	const navInProgressRef = useRef(false);
	// timestamp of navigation start to enforce a short suppression window
	const navStartRef = useRef(0);
	// Modal state for Add New Photo
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [createdId, setCreatedId] = useState(null);
	const [newphoto, setNewphoto] = useState("");
	const [uploaded, setUploaded] = useState(false); // track whether upload completed for the created record
	const [titleConfirmed, setTitleConfirmed] = useState(false);

	// replace handleClose to delete the created record if no upload happened
	const handleClose = async () => {
		try {
			if (createdId && !uploaded) {
				// attempt to remove the placeholder record created when modal opened
				const payload = {
					"dbName": objDBName,
					"collName": "photo",
					"docContents": "{'_id':'" + createdId + "'}",
					"uKey" : "_id"
				};
				await axios.post(API_BASE_URL + '/removeObject', payload);
				// optionally remove from UI lists if present
				setRecords(prev => prev.filter(r => r._id !== createdId));
			}
		} catch (err) {
			console.log('[Photo] failed to cleanup created record on close', err);
		}
		// Reset paging so the photo tab reloads from page 1
		try {
			pageRef.current = 1;
			setPage(1);
			// clear requestedPages so handleLoad will issue a fresh request for page 1
			if (typeof window !== 'undefined') {
				window.__photo_requestedPages = new Set();
				requestedPagesRef.current = window.__photo_requestedPages;
			} else {
				requestedPagesRef.current = new Set();
			}
			// ensure UI shows loading while fetching
			setLoading(true);
			await handleLoad(1);
		} catch (err) {
			console.log('[Photo] error reloading photos on modal close', err);
		} finally {
			// reset modal state
			setIsModalOpen(false);
			setCreatedId(null);
			setNewphoto("");
			setUploaded(false);
			setModalMessage(null);
		}
	};

	// Open modal: create the photo record immediately so DropPhoto can accept uploads and update that record
	const handleOpen = async () => {
		setCreatedId(null);
		setUploaded(false);
		setIsModalOpen(true);
		if (!xid) return; // can't create without xid
		try {
			const payload = {
				"dbName": objDBName,
				"collName": "photo",
				"docContents": "{'xid':'" + xid + "','xuid':'" + xuid + "'}",
				"uKey": "0"
			};
			const response = await axios.post(API_BASE_URL + '/newObject', payload);
			if (response.status === 200 && response.data.doc_201 === 'Document created') {
				setCreatedId(response.data._id);
				// refresh list in background so a placeholder can be visible if needed
				handleLoad(1).catch(()=>{});
			}
		} catch (err) {
			console.log('[Photo] error creating placeholder photo record', err);
		}
	};

	// Called by DropPhoto when upload succeeds. Mark upload completed and refresh list.
	const handleUploadSuccess = async (uploadResponse) => {
		try{
			console.log('[Photo] uploadResponse=', uploadResponse);
			// mark upload completed for the placeholder
			setUploaded(true);
			// if uploadResponse contains an id/compId, ensure createdId matches it
			const possibleId = uploadResponse && (uploadResponse._id || uploadResponse.compId || uploadResponse.insertedId || (uploadResponse.file && uploadResponse.file.compId));
			if (possibleId && possibleId !== createdId) {
				setCreatedId(possibleId);
			}
			setState(prev => ({ ...prev, sMessage: 'Photo uploaded' }));
			// show success inside the modal
			setModalMessage('Photo uploaded');
			// clear modal message after a short delay
			setTimeout(() => setModalMessage(null), 5000);
			// refresh list so the newly-uploaded photo appears
			handleLoad(1).catch(()=>{});
		} catch (err) {
			console.log('[Photo] handleUploadSuccess error', err);
			props.showError && props.showError('Failed to process upload response');
		}
	};

	// Reset paging when the route changes (navigate within SPA) so navigating to this view always starts at page 1
	useEffect(() => {
		// Only reset when pathname changes to a new route (covers in-app navigation)
		// Mark that we've navigated here and suppress any automatic continuation for a short window
		suppressAutoRef.current = true; // stay suppressed until user interaction
		navInProgressRef.current = true;
		navStartRef.current = Date.now();
		if (typeof window !== 'undefined') {
			if (!window.__photo_requestedPages) window.__photo_requestedPages = new Set();
			requestedPagesRef.current = window.__photo_requestedPages;
			requestedPagesRef.current.clear();
			// reset initial-load marker so navigation triggers a fresh initial load
			window.__photo_initialLoad_started = false;
		} else {
			requestedPagesRef.current = new Set();
		}
		pageRef.current = 1;
		setPage(1);
		setRecords([]);
		setHasMore(true);
		setLastFetchedCount(0);
		// reset interaction and observer state so returning to this view starts fresh
		userInteractedRef.current = false;
		initialLoadCompletedRef.current = false;
		if (observerRef.current) { observerRef.current.disconnect(); observerRef.current = null; }

		// After resetting, if xid is already available, trigger the initial load for page 1
		if (xid != null) {
			if (!requestedPagesRef.current.has(1) && !window.__photo_initialLoad_started) {
				window.__photo_initialLoad_started = true;
				// schedule on next frame to ensure DOM refs exist when handleLoad runs
				requestAnimationFrame(() => {
					handleLoad(1, { force: true }).catch(() => { if (typeof window !== 'undefined') window.__photo_initialLoad_started = false; });
				});
			}
		}
	}, [location.pathname]);

	// handleLoad now returns a promise like Xttributes
	const handleLoad = (loadPage = 1, options = {}) =>{
		const force = options.force === true;
		console.log('[Photo] handleLoad page=', loadPage, 'force=', force, 'xid=', xid, 'loadingRef=', loadingRef.current, 'hasMore=', hasMore);
		// If suppression is active (navigated here) and user hasn't interacted,
		// prevent any automatic loads beyond the initial page (unless force=true).
		if (loadPage > 1 && suppressAutoRef.current && !userInteractedRef.current && !force) {
			console.log('[Photo] handleLoad: suppressed auto load for page', loadPage);
			return Promise.resolve();
		}
		// NEW: Prevent any automatic (non-force) load >1 until the initial page load has fully completed.
		// This blocks racey sequential loads triggered by observers or post-load checks during navigation.
		if (loadPage > 1 && !force && !initialLoadCompletedRef.current) {
			console.log('[Photo] handleLoad: blocked auto load for page', loadPage, 'because initial load not completed');
			return Promise.resolve();
		}
		// Stronger guard: if navigation-triggered initial load is still in progress, block non-force loads >1
		if (loadPage > 1 && !force && navInProgressRef.current && !userInteractedRef.current) {
			console.log('[Photo] handleLoad: blocked auto load for page', loadPage, 'because navInProgress');
			return Promise.resolve();
		}
		if (loadPage > 1) {
			if (!force) {
				// older sequential allowances removed — strict gating above handles safety
			} else {
				console.log('[Photo] force load bypassing initial-load gating for page', loadPage);
			}
			// NOTE: removed the strict userInteractedRef gating here so that
			// observer-driven loads can continue loading further pages once
			// the initial load has completed. Interaction gating is still
			// used elsewhere to attach the observer.
		}
		if (!requestedPagesRef.current) requestedPagesRef.current = new Set();
		if (requestedPagesRef.current.has(loadPage) && !force) {
			console.log('[Photo] skipping duplicate request for page', loadPage);
			return Promise.resolve();
		}
		if (xid!=null && !loadingRef.current && hasMore) {
			// mark loading state immediately to prevent concurrent requests
			loadingRef.current = true;
			setLoading(true);
			const payload={
				"dbName": objDBName,
				"collName": "photo",
				"docContents": "{'xid':'" +xid + "'}",
				"operator" : "none",
				"returnType": "list",
				"sortBy": "_id",
				"order": "DESC",
				"limit": PAGE_LIMIT
			}
			return axios.post(API_BASE_URL+`/getObjects?page=${loadPage}` , payload)
			.then(function (response) {
				if(response.status === 200){
					if(response.data.doc_302=== 'Document matched'){
						const objects = response.data.objects || [];
						setLastFetchedCount(objects.length);
						if (objects.length === 0) {
							setHasMore(false);
						} else {
							setRecords(prev => loadPage === 1 ? objects : [...prev, ...objects]);
							if (objects.length < PAGE_LIMIT) {
								setHasMore(false);
							} else {
								setHasMore(true);
							}
							// populate iValues for the batch
							const newI = {};
							objects.forEach(o => { newI["vc_"+o._id] = o.view; });
							setIValues(prev => loadPage === 1 ? newI : ({ ...prev, ...newI }));
						}
					} else {
						setHasMore(false);
					}
				} else{
					props.showError("Oops! system error, it is on us, we are working on it!");
				}
				// mark page as requested only after a successful response
				if (!requestedPagesRef.current) requestedPagesRef.current = new Set();
				requestedPagesRef.current.add(loadPage);
				// ensure observer is attached so sentinel can load the next page
				try {
					// Only attach the observer after we've updated load state and only when
					// it's appropriate: avoid attaching during the initial suppressed window.
					if (attachObserverRef.current && initialLoadCompletedRef.current && (loadPage > 1 || userInteractedRef.current) && !suppressAutoRef.current && !navInProgressRef.current) {
						console.log('[Photo] scheduling attach observer after load page', loadPage);
						requestAnimationFrame(() => {
							try {
								attachObserverRef.current();
								console.log('[Photo] observer attached after rAF for page', loadPage);
							} catch (err) { console.log('[Photo] attach observer rAF error', err); }
						});
					} else {
						console.log('[Photo] skipping attachObserver for page', loadPage, 'suppressAuto=', suppressAutoRef.current, 'userInteracted=', userInteractedRef.current, 'initialLoadCompleted=', initialLoadCompletedRef.current);
					}
				} catch (e) { console.log('[Photo] attach observer error', e); }
			setLoading(false);
			loadingRef.current = false;
			setPage(loadPage);
			pageRef.current = loadPage;
			if (loadPage === 1) {
				initialLoadCompletedRef.current = true;
				initialLoadTimeRef.current = Date.now();
				// initial page finished — clear navigation progress and suppression (but keep suppression until user intent if desired)
				navInProgressRef.current = false;
				// If a user intent occurred before initial load completed, we DON'T auto-promote that
				// intent into userInteracted. Keep it queued so a real gesture after initial
				// load completes is still required. This avoids attaching the observer and
				// immediately triggering further page loads on navigation.
				if (queuedUserIntentRef.current) {
					console.log('[Photo] queued user intent detected — will wait for a real gesture after initial load to enable auto-load');
					// leave queuedUserIntentRef.current = true; do not set userInteractedRef.current here
				}
			}
			// After updating records & page, check if sentinel is still visible and trigger next page
			try {
				requestAnimationFrame(() => {
					try {
						const sentinel = sentinelRef.current;
						if (!sentinel) return;
						const container = photoListRef.current;
						let visible = false;
						const sRect = sentinel.getBoundingClientRect();
						if (container) {
							const cRect = container.getBoundingClientRect();
							visible = sRect.top < cRect.bottom && sRect.bottom > cRect.top;
						} else if (typeof window !== 'undefined') {
							visible = sRect.top < window.innerHeight && sRect.bottom > 0;
						}
						console.log('[Photo] post-load rAF: sentinel visible=', visible, 'pageRef=', pageRef.current, 'requestedPages=', Array.from(requestedPagesRef.current || new Set()), 'suppressAuto=', suppressAutoRef.current);
						// Prevent auto-continuation immediately after initial load/navigate.
						const navSuppressed = suppressAutoRef.current && (Date.now() - navStartRef.current < 800);
						if (loadPage === 1 && (suppressAutoRef.current || navSuppressed) && !userInteractedRef.current) {
							console.log('[Photo] post-load rAF: skipping auto-load because initial suppression is active or within nav window');
							return;
						}
						// Only auto-trigger a subsequent load if not loading and hasMore
						if (visible && !loadingRef.current && hasMore && (loadPage > 1 || userInteractedRef.current)) {
							const next = pageRef.current + 1;
							if (!requestedPagesRef.current || !requestedPagesRef.current.has(next)) {
								console.log('[Photo] post-load rAF: triggering load for page', next);
								// use non-force load here so suppression/initial-load gating is respected
								handleLoad(next).catch(e => console.log('[Photo] post-load handleLoad error', e));
							}
						}
						else {
							console.log('[Photo] post-load rAF: skipping auto-load (initial page or no interaction)');
						}
					} catch (e) { console.log('[Photo] post-load rAF error', e); }
				});
			} catch (e) { console.log('[Photo] post-load rAF scheduling error', e); }
			return Promise.resolve();
		})
		.catch(function (error) {
			console.log(error);
			setLoading(false);
			loadingRef.current = false;
			// allow retry by ensuring this page is NOT marked as requested
			if (requestedPagesRef.current) requestedPagesRef.current.delete(loadPage);
			return Promise.resolve();
		});
		} else {
			console.log('[Photo] handleLoad skipped - xid null, loading, or no more');
			return Promise.resolve();
		}
	}

	// initial load and requestedPages setup
	useEffect(() => {
		if (typeof window !== 'undefined') {
			if (!window.__photo_requestedPages) window.__photo_requestedPages = new Set();
			requestedPagesRef.current = window.__photo_requestedPages;
		} else {
			requestedPagesRef.current = new Set();
		}
		pageRef.current = 1;
		setPage(1);
		setRecords([]);
		setHasMore(true);
		setLastFetchedCount(0);
		userInteractedRef.current = false;
		initialLoadCompletedRef.current = false;
	}, []);

	useEffect(() => {
		if (!requestedPagesRef.current) requestedPagesRef.current = new Set();
		// perform initial load once when xid is available
		if (xid != null) {
			if (!requestedPagesRef.current.has(1) && !window.__photo_initialLoad_started) {
				window.__photo_initialLoad_started = true;
				handleLoad(1).catch(() => { if (typeof window !== 'undefined') window.__photo_initialLoad_started = false; });
			}
		}
	}, [xid]);

	useEffect(()=>{
		loadingRef.current = loading;
	}, [loading]);

	// Ensure the photo list never extends past the bottom of the viewport
	useEffect(() => {
		let raf = null;
		let resizeTimer = null;
		function adjust() {
			try {
				const ul = photoListRef.current;
				if (!ul) return;
				const rect = ul.getBoundingClientRect();
				const bottomSpace = 16; // small gap from bottom
				const available = Math.max(120, window.innerHeight - rect.top - bottomSpace);
				ul.style.maxHeight = available + 'px';
				ul.style.overflowY = 'auto';
			} catch (e) { /* ignore */ }
		}

		function scheduleAdjust() {
			if (raf) cancelAnimationFrame(raf);
			raf = requestAnimationFrame(adjust);
			if (resizeTimer) clearTimeout(resizeTimer);
			resizeTimer = setTimeout(adjust, 120);
		}

		// initial adjust
		scheduleAdjust();
		window.addEventListener('resize', scheduleAdjust);

		// observe mutations inside the list so we recalc when children change
		let mo;
		try {
			if (photoListRef.current && typeof MutationObserver !== 'undefined') {
				mo = new MutationObserver(scheduleAdjust);
				mo.observe(photoListRef.current, { childList: true, subtree: true });
			}
		} catch (err) {
			// ignore
		}

		return () => {
			window.removeEventListener('resize', scheduleAdjust);
			if (raf) cancelAnimationFrame(raf);
			if (resizeTimer) clearTimeout(resizeTimer);
			if (mo) mo.disconnect();
		};
	}, [records.length, isModalOpen]);

	// observer + user interaction handling similar to Xttributes
	useEffect(() => {
		// let attached = false; // removed attached flag
		function createAndObserve() {
			const sentinel = sentinelRef.current;
			if (!sentinel) {
				console.log('[Photo] createAndObserve: sentinel not found');
				return;
			}
			// always recreate the observer to ensure it uses the correct root and latest DOM
			try {
				if (observerRef.current) {
					console.log('[Photo] createAndObserve: disconnecting previous observer to recreate');
					observerRef.current.disconnect();
					observerRef.current = null;
				}
			} catch (err) { console.log('[Photo] error disconnecting previous observer', err); }
			const containerNode = photoListRef.current;
			// choose root only if the container is actually scrollable
			const useContainerAsRoot = !!(containerNode && containerNode.scrollHeight > containerNode.clientHeight);
			const rootNode = useContainerAsRoot ? containerNode : null;
			const options = { root: rootNode, rootMargin: useContainerAsRoot ? '150px' : '300px', threshold: 0.01 };
			console.log('[Photo] createAndObserve: creating observer, rootIsContainer=', useContainerAsRoot, 'options=', options, 'sentinelRect=', sentinel.getBoundingClientRect(), 'containerRect=', containerNode && containerNode.getBoundingClientRect());
			observerRef.current = new IntersectionObserver((entries) => {
				console.log('[Photo] IntersectionObserver callback entries=', entries.map(e => ({isIntersecting: e.isIntersecting, target: e.target && e.target.nodeName, boundingClientRect: e.boundingClientRect}))); 
				entries.forEach(entry => {
					console.log('[Photo] IO entry', { isIntersecting: entry.isIntersecting, intersectionRatio: entry.intersectionRatio, time: Date.now(), entryRect: entry.boundingClientRect });
					if (entry.isIntersecting) {
						// Don't auto-load pages until initial load completed or user interacted
						if (!initialLoadCompletedRef.current && !userInteractedRef.current) {
							console.log('[Photo] IO: skipping force-load because initial load not completed and no user interaction');
							return;
						}
						// Also skip if navigation initial load still in progress or within nav window
						const ioNavSuppressed = suppressAutoRef.current && (Date.now() - navStartRef.current < 800);
						if ((navInProgressRef.current || ioNavSuppressed) && !userInteractedRef.current) {
							console.log('[Photo] IO: skipping force-load because navInProgress or within nav window');
							return;
						}
						if (!loadingRef.current && hasMore) {
							const next = pageRef.current + 1;
							console.log('[Photo] IO: sentinel intersecting, will force-load page', next, 'pageRef=', pageRef.current, 'loadingRef=', loadingRef.current, 'hasMore=', hasMore, 'requestedPages=', Array.from(requestedPagesRef.current || new Set()));
							// Only trigger load if user has interacted or we've moved past page 1
							if (userInteractedRef.current || pageRef.current > 1) {
								handleLoad(next).catch(err => console.log('[Photo] handleLoad from IO error', err));
							} else {
								console.log('[Photo] IO: suppressed trigger for page', next);
							}
						}
					}
				});
			}, options);
			observerRef.current.__attachedAt = Date.now();
			try {
				observerRef.current.observe(sentinel);
				console.log('[Photo] createAndObserve: observing sentinel now');
			} catch (err) {
				console.log('[Photo] createAndObserve: observe error', err);
			}
		}
		// expose to other scopes so we can attach immediately after initial load
		attachObserverRef.current = createAndObserve;

		function onUserIntent(event) {
			if (event && event.isTrusted === false) return;
			if (initialLoadTimeRef.current && Date.now() - initialLoadTimeRef.current < 500) return;
			// If we've already marked a real user interaction, ignore further events
			if (userInteractedRef.current) return;
			// If initial load hasn't completed yet, record that the user interacted
			// but don't create the observer immediately — attach it once the initial
			// page load finishes. This prevents immediate auto-loading of pages
			// during navigation when synthetic or early events may fire.
			if (!initialLoadCompletedRef.current) {
				queuedUserIntentRef.current = true;
				return;
			}
			userInteractedRef.current = true;
			// clear navigation suppression on first real user intent so auto-loading may resume
			suppressAutoRef.current = false;
			if (timerRef.current) clearTimeout(timerRef.current);
			timerRef.current = setTimeout(() => {
				createAndObserve();
				try {
					const sentinel = sentinelRef.current;
					if (sentinel) {
						const containerNode = photoListRef.current;
						let visible = false;
						if (containerNode) {
							const sRect = sentinel.getBoundingClientRect();
							const cRect = containerNode.getBoundingClientRect();
							visible = sRect.top < cRect.bottom && sRect.bottom > cRect.top;
						} else if (typeof window !== 'undefined') {
							const sRect = sentinel.getBoundingClientRect();
							visible = sRect.top < window.innerHeight && sRect.bottom > 0;
						}
						if (visible && !loadingRef.current && hasMore) {
							const next = pageRef.current + 1;
							handleLoad(next);
						}
					}
				} catch (e) { console.log('[Photo] onUserIntent visibility check error', e); }
			}, 200);
			const containerNode = photoListRef.current;
			if (containerNode) containerNode.removeEventListener('scroll', onUserIntent);
			window.removeEventListener('wheel', onUserIntent);
			window.removeEventListener('touchstart', onUserIntent);
			window.removeEventListener('keydown', onUserIntent);
			window.removeEventListener('click', onUserIntent);
		}

		const containerNode = photoListRef.current;
		if (containerNode) containerNode.addEventListener('scroll', onUserIntent, { passive: true });
		window.addEventListener('wheel', onUserIntent, { passive: true });
		window.addEventListener('touchstart', onUserIntent, { passive: true });
		window.addEventListener('keydown', onUserIntent, { passive: true });
		window.addEventListener('click', onUserIntent, { passive: true });

		// If the initial load has completed already, attach the observer immediately
		// so that further pages will be loaded automatically without requiring an explicit user gesture.
		if (initialLoadCompletedRef.current && attachObserverRef.current) {
			// Only auto-attach if the initial load finished and either user interacted or we've moved past page 1
			if ((pageRef.current > 1 || userInteractedRef.current) && !suppressAutoRef.current && !navInProgressRef.current) {
				attachObserverRef.current();
			}
		}

		return () => {
			const containerNode = photoListRef.current;
			if (containerNode) containerNode.removeEventListener('scroll', onUserIntent);
			window.removeEventListener('wheel', onUserIntent);
			window.removeEventListener('touchstart', onUserIntent);
			window.removeEventListener('keydown', onUserIntent);
			window.removeEventListener('click', onUserIntent);
			if (timerRef.current) clearTimeout(timerRef.current);
			if (observerRef.current) observerRef.current.disconnect();
		};
	}, [hasMore, records.length, lastFetchedCount]);

	useEffect(() => {
		let lastTriggeredAt = 0;
		function checkSentinelAndLoad(e) {
			if (e && e.isTrusted === false) return;
			if (initialLoadTimeRef.current && Date.now() - initialLoadTimeRef.current < 500) return;
			const now = Date.now();
			if (now - lastTriggeredAt < 300) return;
			lastTriggeredAt = now;
			try {
				// If navigation suppression is active and the user hasn't interacted yet,
				// avoid auto-triggering additional pages while still on the initial page.
				if (suppressAutoRef.current && pageRef.current <= 1 && !userInteractedRef.current) {
					console.log('[Photo] checkSentinelAndLoad: suppressed during navigation');
					return;
				}
				const sentinel = sentinelRef.current;
				if (!sentinel) return;
				const container = photoListRef.current;
				let visible = false;
				if (container) {
					const sRect = sentinel.getBoundingClientRect();
					const cRect = container.getBoundingClientRect();
					visible = sRect.top < cRect.bottom && sRect.bottom > cRect.top;
				} else if (typeof window !== 'undefined') {
					const sRect = sentinel.getBoundingClientRect();
					visible = sRect.top < window.innerHeight && sRect.bottom > 0;
				}
				if (visible && !loadingRef.current && hasMore) {
					const next = pageRef.current + 1;
					if (!requestedPagesRef.current.has(next)) {
						handleLoad(next);
					}
				}
			} catch (err) { console.log('[Photo] scroll listener error', err); }
		}

		const containerNode = photoListRef.current;
		if (containerNode) containerNode.addEventListener('scroll', checkSentinelAndLoad, { passive: true });
		window.addEventListener('wheel', checkSentinelAndLoad, { passive: true });
		window.addEventListener('touchstart', checkSentinelAndLoad, { passive: true });
		window.addEventListener('keydown', checkSentinelAndLoad, { passive: true });
		window.addEventListener('click', checkSentinelAndLoad, { passive: true });

		return () => {
			const containerNode = photoListRef.current;
			if (containerNode) containerNode.removeEventListener('scroll', checkSentinelAndLoad);
			window.removeEventListener('wheel', checkSentinelAndLoad);
			window.removeEventListener('touchstart', checkSentinelAndLoad);
			window.removeEventListener('keydown', checkSentinelAndLoad);
			window.removeEventListener('click', checkSentinelAndLoad);
		};
	}, [hasMore, records.length, lastFetchedCount]);

	//console.log(iValues);
	const handleChange = ({ target }) => {
		setIValues(prevIValues => ({
		  ...prevIValues,
		  [target.name]: target.value
		}))
	} 													
	const savePTitle = (text, keyId) => {
				const editPayload={
					"dbName": objDBName,
					"collName": "photo",
					"docContents": "{'_id':'" +keyId + "','title':'" +text + "'}",
					"uKey" :"_id",
					"updateKey" : "title"
					}
				axios.post(API_BASE_URL+'/editObject', editPayload, )
				.then(function (response) {
					if(response.status === 200){
						if(response.data.doc_202 === 'Document updated'){
							setState(prevState => ({
								...prevState,
								'sMessage' : 'Photo title updated!'
							}))
						}                 
					} else{
						props.showError("Oops! system error, it is on us, we are working on it!");
					}
				})
				.catch(function (error) {
					console.log(error);
				});     													
	}
	
	const now = new Date();
	const kDate = now.toLocaleDateString();
	const textareaRef = useRef();
	const inputRef = useRef();

	const removePhoto =(id) =>{
		const payload={
			"dbName": objDBName,
			"collName": "photo",
					"docContents": "{'_id':'" +id + "'}",
					"uKey" : "_id"
		}
		axios.post(API_BASE_URL+'/removeObject', payload, )
		.then(function (response) {
			if(response.status === 200){
				if(response.data.doc_204 === 'Document deleted'){
					setPhotos(photos.filter(photo=> photo.id !== id));
					setRecords(records.filter(record=>record._id !== id));
				}                 
			} else{
				props.showError("Oops! system error, it is on us, we are working on it!");
			}
		})
		.catch(function (error) {
			props.showError("Oops! system error, it is on us, we are working on it!");
			console.log(error);
		});
		
	 }
	const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
	let isEdit = false; if (props.editable == "t") isEdit = true;

	// confirm title and optionally save
	const confirmTitle = async () => {
		const title = (newphoto || '').trim();
		if (!title) {
			setTitleConfirmed(false);
			return;
		}
		if (createdId) {
			try {
				await savePTitle(title, createdId);
				setTitleConfirmed(true);
			} catch (err) {
				console.log('[Photo] confirmTitle save error', err);
				setTitleConfirmed(false);
			}
		} else {
			setTitleConfirmed(true);
		}
	};

	return (
		<div id="photoListsContainer">
			{isEdit ? (
			<div className="addButton">
				<Button className="button-8 add-button-plain" endIcon={<PhotoLibraryOutlinedIcon fontSize="small" />} onClick={handleOpen} variant="text" disableElevation disableRipple>
					+ Photo
				</Button>
			</div>
		) : ''}
			
			<ul className="photoList" ref={photoListRef}>
				<Photos records={records} onSaveTitle={savePTitle} ontextChange={handleChange} removePhoto={removePhoto} iValues={iValues} setIValues={setIValues} editable={props.editable} isEdit={isEdit} />
				{/* sentinel for IntersectionObserver (kept invisible) */}
				<div ref={sentinelRef} style={{ height: '20px' }} aria-hidden="true" />
			</ul>
			{loading && <li style={{textAlign:'center'}}>Loading...</li>}
			{!hasMore && <li style={{textAlign:'center', color:'#888'}}>No more photos</li>}
			{hasMore && !loading && (
			<li
				style={{ textAlign: 'center', color: '#888', cursor: 'pointer' }}
				onClick={async () => {
					const next = pageRef.current + 1;
					if (!requestedPagesRef.current) requestedPagesRef.current = new Set();
					console.log('[Photo] load-more click next=', next, 'pageRef=', pageRef.current, 'loadingRef=', loadingRef.current, 'hasMore=', hasMore, 'requestedPages=', Array.from(requestedPagesRef.current));
					if (!loadingRef.current && hasMore) {
						// Try a direct axios POST for debugging to ensure network call happens
						try {
							const payload = {
								"dbName": objDBName,
								"collName": "photo",
								"docContents": "{'xid':'" + xid + "'}",
								"operator" : "none",
								"returnType": "list",
								"sortBy": "_id",
								"order": "DESC",
								"limit": PAGE_LIMIT
							};
							console.log('[Photo] debug: sending direct axios for page', next);
							const resp = await axios.post(API_BASE_URL+`/getObjects?page=${next}`, payload);
							console.log('[Photo] debug direct response:', resp && resp.status, resp && resp.data);
							if (resp && resp.status === 200 && resp.data && resp.data.doc_302 === 'Document matched') {
								const objects = resp.data.objects || [];
								setLastFetchedCount(objects.length);
								if (objects.length > 0) {
									setRecords(prev => [...prev, ...objects]);
									if (objects.length < PAGE_LIMIT) setHasMore(false);
									requestedPagesRef.current.add(next);
									setPage(next);
									pageRef.current = next;
								} else {
									setHasMore(false);
								}
							} else {
								console.log('[Photo] debug direct response did not match docs or error');
								// fallback to normal loader
								handleLoad(next, { force: true }).catch(()=>{});
							}
						} catch (err) {
							console.log('[Photo] debug direct axios error', err);
							// fallback to handleLoad
							handleLoad(next, { force: true }).catch(()=>{});
						}
					} else {
						console.log('[Photo] load-more click skipped (already loading or no more)');
					}
				}}
				onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const next = pageRef.current + 1; if (!requestedPagesRef.current) requestedPagesRef.current = new Set(); console.log('[Photo] load-more keydown next=', next, 'pageRef=', pageRef.current, 'requestedPages=', Array.from(requestedPagesRef.current)); if (!loadingRef.current && hasMore) { handleLoad(next, { force: true }); } else { console.log('[Photo] load-more keydown skipped'); } } }}
				role="button"
				tabIndex={0}
			>
			  Scroll or click to load more photos
			</li>
		  )}

		  {/* Debug panel removed for production - re-add during troubleshooting if needed */}
		  {/*
		  <div style={{position: 'fixed', right: 8, bottom: 8, background: 'rgba(0,0,0,0.7)', color: '#fff', padding: 8, fontSize: 12, zIndex: 9999, maxWidth: 320}}>
			<div style={{fontWeight: 'bold', marginBottom: 6}}>Photo debug</div>
			<div>pageRef: {pageRef.current}</div>
			<div>page(state): {page}</div>
			<div>loadingRef: {String(loadingRef.current)}</div>
			<div>hasMore: {String(hasMore)}</div>
			<div>lastFetchedCount: {lastFetchedCount}</div>
			<div>requestedPages: {JSON.stringify(Array.from((requestedPagesRef.current || new Set())))}</div>
			<div style={{marginTop:6}}>xid: {String(xid)}</div>
			<div style={{marginTop:8}}>
				<button onClick={async () => {
					const next = pageRef.current + 1;
					console.log('[Photo][debug button] forcing axios for page', next, 'ignoring hasMore/loading');
					try {
						const payload = {
							"dbName": objDBName,
							"collName": "photo",
							"docContents": "{'xid':'" + xid + "'}",
							"operator" : "none",
							"returnType": "list",
							"sortBy": "_id",
							"order": "DESC",
							"limit": PAGE_LIMIT
						};
						const resp = await axios.post(API_BASE_URL+`/getObjects?page=${next}`, payload);
						console.log('[Photo][debug button] resp:', resp && resp.status, resp && resp.data);
						if (resp && resp.status === 200 && resp.data && resp.data.doc_302 === 'Document matched') {
							const objects = resp.data.objects || [];
							setLastFetchedCount(objects.length);
							if (objects.length > 0) {
								setRecords(prev => [...prev, ...objects]);
								if (objects.length < PAGE_LIMIT) setHasMore(false);
								requestedPagesRef.current.add(next);
								setPage(next);
								pageRef.current = next;
							}
						} else {
							console.log('[Photo][debug button] unexpected response or no docs');
						}
					} catch (err) {
						console.log('[Photo][debug button] error', err);
					}
				}}>Force load (debug)</button>
			</div>
		  */}

		  {/* Add New Photo Modal */}
		  <Modal open={isModalOpen} onClose={handleClose}>
			<div style={{
				position: 'absolute',
				top: '50%',
				left: '50%',
				transform: 'translate(-50%, -50%)',
				width: 480,
				backgroundColor: 'white',
				border: '1px solid #ccc',
				boxShadow: 24,
				zIndex: 1300, // ensure modal sits above other elements
				padding: '16px',
				maxHeight: '80vh',
				overflow: 'auto'
			}}>
				{/* Header: + Photo with icon and close button at corner */}
				<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
					<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
						<PhotoLibraryOutlinedIcon fontSize="small" />
						<strong style={{ fontSize: 18 }}>+ Photo</strong>
					</div>
					<IconButton size="small" onClick={handleClose} aria-label="close">
						<CloseIcon />
					</IconButton>
				</div>
				{/* show modal-specific success message here */}
				{modalMessage ? <div style={{ marginTop: 8 }}><SuccessMessage successMessage={modalMessage} /></div> : null}
				<ResizableBox className="resizebox" width={420} height={400}>
					<div className="newPhotoTitle" style={{ padding: 8 }}>
						<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
							<input
								type="text"
								placeholder="Title (optional)"
								value={newphoto}
								onChange={e => { setNewphoto(e.target.value); setTitleConfirmed(false); }}
								onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); confirmTitle(); } }}
								style={{ flex: 1, padding: '8px', boxSizing: 'border-box' }}
							/>
							<IconButton size="small" onClick={confirmTitle} aria-label="confirm title" title="Confirm title">
								<CheckIcon style={{ color: titleConfirmed ? '#2e7d32' : undefined }} />
							</IconButton>
						</div>
					</div>
					<div style={{ padding: 8 }}>
						<DropPhoto
							key={createdId || 'new-drop'}
							type="photo"
							folder="photo"
							showError={props.showError}
							dbName="xtrObject"
							collName="photo"
							compId={createdId}
							onUploadSuccess={handleUploadSuccess}
							previewHeight="200px"
						/>
					</div>
				</ResizableBox>
				{/* Removed Save and Close buttons; modal closes via X in corner */}
			</div>
		  </Modal>
			 </div>
		);
 }

 export default Photo;
