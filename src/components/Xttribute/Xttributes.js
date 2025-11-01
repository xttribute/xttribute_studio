import React from 'react';
import axios from 'axios';
import {useState,useRef,useEffect} from 'react';
import { useLocation } from 'react-router-dom';
import {API_BASE_URL, objDBName} from '../../constants/apiConstants';
import XttributesList from '../Layout/XttributesList';
import useUserSession from '../User/useUserSession';
function Xttributes(props){
	const {uid} = useUserSession();
	const[records, setRecords] =useState([]); // changed from 0 to [] so it's iterable
	const [page, setPage] = useState(1); // pagination
	const pageRef = useRef(1);
	const [loading, setLoading] = useState(false);
	const [hasMore, setHasMore] = useState(true);
	// page size constant used in requests and hint logic
	const PAGE_LIMIT = 5;
	const [lastFetchedCount, setLastFetchedCount] = useState(0);
 	const containerRef = useRef(null);
 	const loadingRef = useRef(loading);
 	const sentinelRef = useRef(null);
	// only start observing sentinel after user interaction to avoid auto-loading multiple pages on initial render
	const userInteractedRef = useRef(false);
	const timerRef = useRef(null);
 	const initialLoadCompletedRef = useRef(false);
 	const initialLoadTimeRef = useRef(0);
 	const observerAttachTimeRef = useRef(0);
 	const observerRef = useRef(null);
	// track pages already requested or in-flight to avoid duplicate calls
	// Persist the set on window so React StrictMode remounts in development don't reset it
	const requestedPagesRef = useRef(null);
	const location = useLocation();

	// Reset paging when the route changes (navigate within SPA) so navigating to this view always starts at page 1
	useEffect(() => {
		// Only reset when pathname changes to a new route (covers in-app navigation)
		if (typeof window !== 'undefined') {
			if (!window.__xttributes_requestedPages) window.__xttributes_requestedPages = new Set();
			// keep the same Set object (avoid reassigning) so React StrictMode remounts don't cause duplicate requests
			requestedPagesRef.current = window.__xttributes_requestedPages;
			requestedPagesRef.current.clear();
			// reset initial-load marker so navigation triggers a fresh initial load
			window.__xttributes_initialLoadStarted = false;
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
	}, [location.pathname]);

	// Reset paging when the component mounts (navigation or full reload) so we always start at page 1
	useEffect(() => {
		if (typeof window !== 'undefined') {
			if (!window.__xttributes_requestedPages) window.__xttributes_requestedPages = new Set();
			// preserve the same Set and initialLoad marker across remounts. Do NOT clear here (avoids double-load in StrictMode).
			requestedPagesRef.current = window.__xttributes_requestedPages;
		} else {
			requestedPagesRef.current = new Set();
		}
		pageRef.current = 1;
		setPage(1);
		setRecords([]);
		setHasMore(true);
		setLastFetchedCount(0);
		// ensure interaction state is reset on mount
		userInteractedRef.current = false;
		initialLoadCompletedRef.current = false;
	// empty deps -> run on mount only
	}, []);

	useEffect(() => {
		// initialize requestedPagesRef and perform the initial load only after initialization
		if (typeof window !== 'undefined') {
			if (!window.__xttributes_requestedPages) window.__xttributes_requestedPages = new Set();
			requestedPagesRef.current = window.__xttributes_requestedPages;
		} else {
			requestedPagesRef.current = new Set();
		}
		props.updateTitle("Xttributes");
		// perform initial load once when uid is available
		if (uid != null) {
			// guard: if page 1 not requested yet, call handleLoad(1)
			if (!requestedPagesRef.current.has(1) && !window.__xttributes_initialLoadStarted) {
				// mark that initial load has been started for this navigation so StrictMode double-mounts don't re-trigger
				window.__xttributes_initialLoadStarted = true;
				handleLoad(1).catch(() => {
					// if page 1 failed, allow retry
					if (typeof window !== 'undefined') window.__xttributes_initialLoadStarted = false;
				});
			}
		}
	}, [uid]);

	const handleLoad = (loadPage = 1) =>{
		// return a promise so callers can chain (e.g., prefetch page 2 after page 1)
		// Note: callers should still respect the in-flight guard to avoid duplicates.
		console.log('[Xttributes] handleLoad start, page=', loadPage, 'uid=', uid, 'loadingRef=', loadingRef.current, 'hasMore=', hasMore);
		if (loadPage > 1) {
			// help debugging unexpected callers
			try { console.log('[Xttributes] handleLoad called for page>1 - stack:\n', new Error().stack); } catch (e) {}
		}
		// Strict guard: do not allow automatic loads of pages >1 unless user has interacted and initial load completed
		// This prevents navigation/reload from triggering page 2.
		// skip if this page has been requested already or is currently in-flight
		if (loadPage > 1) {
			// require that initial page completed, a short grace period has passed, and user interacted
			if (!initialLoadCompletedRef.current) {
				console.log('[Xttributes] blocked load for page', loadPage, 'because initial load not completed yet');
				return Promise.resolve();
			}
			// enforce a small delay after initial load to avoid races on navigation
			if (initialLoadTimeRef.current && Date.now() - initialLoadTimeRef.current < 500) {
				console.log('[Xttributes] blocked load for page', loadPage, 'because within initial-load grace period');
				return Promise.resolve();
			}
			if (!userInteractedRef.current) {
				console.log('[Xttributes] blocked load for page', loadPage, 'because no user interaction yet');
				return Promise.resolve();
			}
		}
		if (requestedPagesRef.current.has(loadPage)) {
			console.log('[Xttributes] skipping duplicate request for page', loadPage);
			return Promise.resolve();
		}
		if (uid!=null && !loadingRef.current && hasMore) {
			// mark this page as requested (in-flight)
			requestedPagesRef.current.add(loadPage);
			loadingRef.current = true; // mark immediately to prevent double triggers
			setLoading(true);
			const payload={
				"dbName": objDBName,
				"collName": "xttribute",
				"docContents": "{'uid':'" +uid + "'}",
				"operator" : "none",
				"returnType": "list",
				"sortBy": "_id",
				"limit": PAGE_LIMIT,
				"order": "ASC"
				}
			return axios.post(API_BASE_URL+`/getObjects?page=${loadPage}`, payload)
			.then(function (response) {
				console.log('[Xttributes] getObjects response status=', response.status, 'page=', loadPage);
				if(response && response.data) console.log('[Xttributes] response.doc codes=', response.data.doc_302 || response.data.doc_202 || response.data.doc_204);
				if(response.status === 200){
					if(response.data.doc_302=== 'Document matched'){
						const objects = response.data.objects || [];
						console.log('[Xttributes] objects.length=', objects.length);
						// update last fetched count so UI knows whether to show the "scroll to load more" hint
						setLastFetchedCount(objects.length);
						// If no objects returned -> no more. If fewer than a full page returned -> last page.
						if (objects.length === 0) {
							setHasMore(false);
						} else {
							setRecords(prev => loadPage === 1 ? objects : [...prev, ...objects]);
							if (objects.length < PAGE_LIMIT) {
								setHasMore(false);
							} else {
								setHasMore(true);
							}
						}
					} else {
						setHasMore(false);
					}
				} else{
					props.showError("Oops! system error, it is on us, we are working on it!");
				}
				setLoading(false);
				loadingRef.current = false;
				// update page state/ref to the loaded page
				setPage(loadPage);
				pageRef.current = loadPage;
				// if this was the first page, mark initial load completed so observers/listeners can act
				if (loadPage === 1) {
					initialLoadCompletedRef.current = true;
					initialLoadTimeRef.current = Date.now();
				}
				// mark this page as completed (keep it in the set to avoid re-requests in this session)
				requestedPagesRef.current.add(loadPage);
			})
			.catch(function (error) {
				console.log('[Xttributes] getObjects error', error && error.toString ? error.toString() : error);
				setLoading(false);
				loadingRef.current = false;
				// remove from requested set so it can be retried if needed
				requestedPagesRef.current.delete(loadPage);
				return Promise.resolve();
			});    
		} else {
			console.log('[Xttributes] handleLoad skipped - either uid null, already loading, or no more');
			return Promise.resolve();
		}
	}

	// clear requested pages when uid changes so a new user gets fresh paging
	useEffect(() => {
	    if (requestedPagesRef.current) requestedPagesRef.current.clear();
 	    pageRef.current = 1;
 	    setPage(1);
 	    setHasMore(true);
 	}, [uid]);

	// remove container/window scroll handlers - using IntersectionObserver on viewport
	// (previous debouncedHandleScroll and debouncedWindowScroll removed)

	useEffect(()=>{
		loadingRef.current = loading;
	}, [loading]);

	// remove auto-attaching IntersectionObserver effect
	// If initial data has loaded, ensure an IntersectionObserver is attached so scrolling will load more.
	// useEffect(() => {
		// do nothing if already attached
		// if (observerRef.current) return;
		// only attach after we have some records and more pages are allowed
		// if (!sentinelRef.current) return;
		// if (records.length === 0) return;
		// if (!hasMore) return;
		// create observer similar to createAndObserve logic
		// const containerNode = containerRef.current;
		// const useContainerAsRoot = containerNode && containerNode.scrollHeight > containerNode.clientHeight;
		// const rootNode = useContainerAsRoot ? containerNode : null;
		// console.log('[Xttributes] auto-attaching IntersectionObserver (after initial load) root=', useContainerAsRoot ? 'container' : 'viewport');
		// const options = { root: rootNode, rootMargin: '150px', threshold: 0.01 };
		// observerRef.current = new IntersectionObserver((entries) => {
		// 	entries.forEach(entry => {
		// 		if (entry.isIntersecting) {
		// 			console.log('[Xttributes] auto-observer: sentinel intersecting, candidate to load next page');
		// 			// if last fetched page had fewer than PAGE_LIMIT items, it's the last page — don't request more
		// 			if (lastFetchedCount > 0 && lastFetchedCount < PAGE_LIMIT) {
		// 				console.log('[Xttributes] auto-observer: lastFetchedCount < PAGE_LIMIT; not fetching more.');
		// 				setHasMore(false);
		// 				return;
		// 			}
		// 			if (!loadingRef.current && hasMore) {
		// 				const next = pageRef.current + 1;
		// 				console.log('[Xttributes] auto-observer requesting next page =', next);
		// 				handleLoad(next);
		// 			}
		// 		}
		// 	});
		// }, options);
		// observerRef.current.observe(sentinelRef.current);

		// return () => {
		// 	if (observerRef.current) observerRef.current.disconnect();
		// 	observerRef.current = null;
		// };
	// }, [records.length, hasMore, lastFetchedCount]);

	useEffect(() => {
		let attached = false;

		function createAndObserve() {
			if (attached) return;
			const sentinel = sentinelRef.current;
			if (!sentinel) return;
			const containerNode = containerRef.current;
			const useContainerAsRoot = containerNode && containerNode.scrollHeight > containerNode.clientHeight;
			const rootNode = useContainerAsRoot ? containerNode : null; // null means viewport
			console.log('[Xttributes] IntersectionObserver rootNode (on user interaction):', useContainerAsRoot ? 'container' : 'viewport');
			const options = { root: rootNode, rootMargin: '150px', threshold: 0.01 };
			observerAttachTimeRef.current = Date.now();
			observerRef.current = new IntersectionObserver((entries) => {
				entries.forEach(entry => {
					if (entry.isIntersecting) {
						console.log('[Xttributes] sentinel intersecting after user interaction, attempting to load next page');
						// ignore very-early intersections that occur within a grace period after attaching
						if (Date.now() - observerAttachTimeRef.current < 300) {
							console.log('[Xttributes] ignoring early intersection (grace period)');
							return;
						}
						// if last fetched page had fewer than PAGE_LIMIT items, it's the last page — don't request more
						if (lastFetchedCount > 0 && lastFetchedCount < PAGE_LIMIT) {
							console.log('[Xttributes] last fetched count < PAGE_LIMIT; no more pages. Hiding hint and not fetching.');
							setHasMore(false);
							return;
						}
						if (!loadingRef.current && hasMore) {
							const next = pageRef.current + 1;
							console.log('[Xttributes] requesting next page =', next);
							handleLoad(next);
						}
					}
				});
			}, options);
			observerRef.current.observe(sentinel);
			attached = true;
		}

		function onUserIntent(event) {
			// ignore synthetic/programmatic events
			if (event && event.isTrusted === false) return;
			// ignore interactions that happen immediately after the initial load to avoid auto-loading page 2 on navigation
			if (initialLoadTimeRef.current && Date.now() - initialLoadTimeRef.current < 500) {
				console.log('[Xttributes] ignoring onUserIntent because it occurred too soon after initial load');
				return;
			}
			if (userInteractedRef.current) return;
			userInteractedRef.current = true;
			// Delay attaching the observer slightly to avoid immediate intersection triggering a next-page load
			if (timerRef.current) clearTimeout(timerRef.current);
			timerRef.current = setTimeout(() => {
				createAndObserve();
				// after attaching observer, if sentinel is already visible, explicitly request next page
				try {
					const sentinel = sentinelRef.current;
					if (sentinel) {
						const containerNode = containerRef.current;
						let visible = false;
						if (containerNode) {
							const sRect = sentinel.getBoundingClientRect();
							const cRect = containerNode.getBoundingClientRect();
							// consider sentinel visible if within container's viewport
							visible = sRect.top < cRect.bottom && sRect.bottom > cRect.top;
						} else if (typeof window !== 'undefined') {
							const sRect = sentinel.getBoundingClientRect();
							visible = sRect.top < window.innerHeight && sRect.bottom > 0;
						}
						if (visible && !loadingRef.current && hasMore) {
							const next = pageRef.current + 1;
							console.log('[Xttributes] onUserIntent detected visible sentinel, requesting next page =', next);
							handleLoad(next);
						}
					}
				} catch (e) { console.log('[Xttributes] onUserIntent visibility check error', e); }
			}, 200);
			// remove listeners
			const containerNode = containerRef.current;
			if (containerNode) containerNode.removeEventListener('scroll', onUserIntent);
			window.removeEventListener('wheel', onUserIntent);
			window.removeEventListener('touchstart', onUserIntent);
			window.removeEventListener('keydown', onUserIntent);
			window.removeEventListener('click', onUserIntent);
		}

		// attach one-time listeners for explicit user interactions (wheel, touchstart, keydown, click)
		const containerNode = containerRef.current;
		if (containerNode) containerNode.addEventListener('scroll', onUserIntent, { passive: true });
		window.addEventListener('wheel', onUserIntent, { passive: true });
		window.addEventListener('touchstart', onUserIntent, { passive: true });
		window.addEventListener('keydown', onUserIntent, { passive: true });
		window.addEventListener('click', onUserIntent, { passive: true });

		// cleanup
		return () => {
			const containerNode = containerRef.current;
			if (containerNode) containerNode.removeEventListener('scroll', onUserIntent);
			window.removeEventListener('wheel', onUserIntent);
			window.removeEventListener('touchstart', onUserIntent);
			window.removeEventListener('keydown', onUserIntent);
			window.removeEventListener('click', onUserIntent);
			if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
			if (observerRef.current) observerRef.current.disconnect();
		};
	}, [hasMore, records.length, lastFetchedCount]);

	useEffect(() => {
		let lastTriggeredAt = 0;
		function checkSentinelAndLoad(e) {
			// only respond to real user actions
			if (e && e.isTrusted === false) return;
			// ignore events that happen immediately after the initial load to avoid auto-loading page 2 on navigation
			if (initialLoadTimeRef.current && Date.now() - initialLoadTimeRef.current < 500) {
				console.log('[Xttributes] ignoring early interaction event after initial load');
				return;
			}
			// treat this event as a real user interaction (debounced)
			// if (e && e.isTrusted) {
			// 	userInteractedRef.current = true;
			// }
			const now = Date.now();
			if (now - lastTriggeredAt < 300) return; // debounce
			lastTriggeredAt = now;
			try {
				const sentinel = sentinelRef.current;
				if (!sentinel) return;
				const container = containerRef.current;
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
					if (!userInteractedRef.current) {
						console.log('[Xttributes] visible sentinel but no user interaction recorded yet — skipping load');
						return;
					}
					const next = pageRef.current + 1;
					if (!requestedPagesRef.current.has(next)) {
						console.log('[Xttributes] scroll-listener requesting next page =', next);
						handleLoad(next);
					}
				}
			} catch (err) { console.log('[Xttributes] scroll listener error', err); }
		}

		// attach listeners immediately so navigation scrolls are captured
		const containerNode = containerRef.current;
		if (containerNode) containerNode.addEventListener('scroll', checkSentinelAndLoad, { passive: true });
		window.addEventListener('wheel', checkSentinelAndLoad, { passive: true });
		window.addEventListener('touchstart', checkSentinelAndLoad, { passive: true });
		window.addEventListener('keydown', checkSentinelAndLoad, { passive: true });
		window.addEventListener('click', checkSentinelAndLoad, { passive: true });

		return () => {
			const containerNode = containerRef.current;
			if (containerNode) containerNode.removeEventListener('scroll', checkSentinelAndLoad);
			window.removeEventListener('wheel', checkSentinelAndLoad);
			window.removeEventListener('touchstart', checkSentinelAndLoad);
			window.removeEventListener('keydown', checkSentinelAndLoad);
			window.removeEventListener('click', checkSentinelAndLoad);
		};
	}, [hasMore, records.length, lastFetchedCount]);

	return(
		<div>
		  {/* Inject CSS to hide scrollbars but keep scrolling functional */}
		  <style>{`.no-scrollbar{ scrollbar-width: none; -ms-overflow-style: none; }
			.no-scrollbar::-webkit-scrollbar{ display: none; }
		  `}</style>
		  <div className="container no-scrollbar" ref={containerRef} style={{position: 'fixed', top: '15px', left: 0, right: 0, height: 'calc(100vh - 15px)', overflowY: 'auto', zIndex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'stretch', paddingTop: 0}}>
           <div style={{flex: '0 0 auto'}}>
              <XttributesList records={records} />
            </div>
			{loading && <div style={{textAlign:'center'}}>Loading...</div>}
			{!hasMore && <div style={{textAlign:'center', color:'#888'}}>No more xttributes</div>}
            {/* hint shown when more items are available and not currently loading. Only show if last fetch was a full page. */}
            {hasMore && !loading && lastFetchedCount === PAGE_LIMIT && (
              <div style={{textAlign: 'center', color: '#666', padding: '8px 0'}}>Scroll to load more</div>
            )}
			{/* sentinel element observed by IntersectionObserver placed inside the scroll container */}
			<div ref={sentinelRef} style={{ height: '1px' }} />
		 </div>
		</div>
	);
};
export default Xttributes