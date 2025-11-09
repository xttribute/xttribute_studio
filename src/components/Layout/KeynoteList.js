import React , {useState,useRef,useEffect} from 'react';
import './KeynoteList.css';
import Editable from '../InlineEdit/Editable';
import DeleteIcon from '@mui/icons-material/Delete';
import IconButton from '@mui/material/IconButton'
import { Row, Col } from 'reactstrap';
import { CiEdit } from "react-icons/ci";
import CheckIcon from '@mui/icons-material/Check';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
const KeynoteList = ({ records, onSaveDate, onSaveContent, onTextChange, removeKeynote, iValues, setIValues, editable, isEdit, focusKDateId, onLoadMore, hasMore, loading, scrollContainerRef, initialLoadDone }) => {
     const textareaRef = useRef();
     const inputRef = useRef();
     const kDateEditRefs = useRef({});
     const noteRefs = useRef({}); // refs to each note display wrapper for overflow detection
     const noteEditRefs = useRef({}); // programmatic edit controllers for each note
     const containerRef = useRef(null);
     const lastScrollRef = useRef(0);
     const [editNoteId, setEditNoteId] = useState(null);
     const COLLAPSED_MAX = 110; // collapsed max height in px
     const [editKDateId, setEditKDateId] = useState(null);
     const [showExpandMap, setShowExpandMap] = useState({});
     const [expandedMap, setExpandedMap] = useState({});

    // ensure stable refs exist for each record so programmatic control works for all items
    useEffect(() => {
        (records || []).forEach(rec => {
            const rid = String(rec._id);
            if (!kDateEditRefs.current[rid]) kDateEditRefs.current[rid] = React.createRef();
            if (!noteEditRefs.current[rid]) noteEditRefs.current[rid] = React.createRef();
        });
    }, [records]);

    // If parent asks to focus a specific kDate start edit and focus the input
    useEffect(() => {
        if (!focusKDateId) return;
        const id = String(focusKDateId);
        // attempt immediate start
        const tryStart = () => {
            try {
                if (kDateEditRefs.current[id] && kDateEditRefs.current[id].current) {
                    kDateEditRefs.current[id].current.start();
                    setEditKDateId(id);
                    // focus the underlying input if present
                    const inputEl = document.querySelector(`input[data-key-id="${id}"]`);
                    if (inputEl && typeof inputEl.focus === 'function') {
                        inputEl.focus();
                        // place cursor at end
                        try { const len = inputEl.value ? inputEl.value.length : 0; inputEl.setSelectionRange(len, len); } catch(e){}
                        // scroll into view
                        try { inputEl.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch(e){}
                    }
                    return true;
                }
            } catch (e) { /* ignore */ }
            return false;
        };

        if (!tryStart()) {
            // refs may not be ready; retry shortly
            const t = setTimeout(() => { tryStart(); }, 50);
            return () => clearTimeout(t);
        }
    }, [focusKDateId, records]);

    // programmatically start editing a note
    const handleNoteEdit = (id) => {
        setEditNoteId(id);
        if (noteEditRefs.current[id] && noteEditRefs.current[id].current) {
            try { noteEditRefs.current[id].current.start(); } catch (e) { /* ignore */ }
        }
    };
    
    const handleNoteConfirm = (id) => {
        if (noteEditRefs.current[id] && noteEditRefs.current[id].current) {
            try { noteEditRefs.current[id].current.save(); } catch (e) { /* ignore */ }
        }
        setEditNoteId(null);
    };
     const handleChange = ({ target }) => {
             setIValues(prevIValues => ({
               ...prevIValues,
               [target.name]: target.value
             }))
         }

	// auto-resize textarea to fit content so it matches the static div height when editing
	const autoResize = (e) => {
		try {
			const el = e.target;
			el.style.overflow = 'hidden';
			el.style.height = 'auto';
			el.style.height = `${el.scrollHeight}px`;
		} catch (err) { /* ignore */ }
	};
		
	// compute whether each static note is overflowing its visible area
	useEffect(() => {
		const compute = () => {
			const newMap = {};
			(records || []).forEach((rec) => {
				const wrapper = noteRefs.current[String(rec._id)];
				if (!wrapper) { newMap[String(rec._id)] = false; return; }
				// find the element that holds the static note text
				const contentEl = wrapper.querySelector('.editable-textarea-keynote');
				if (!contentEl) { newMap[String(rec._id)] = false; return; }
				// treat as overflowing if content height exceeds the collapsed max
				newMap[String(rec._id)] = contentEl.scrollHeight > COLLAPSED_MAX + 1;

				// set an explicit inline maxHeight so short notes size to content and long notes cap at COLLAPSED_MAX
				try {
					// ensure natural height before measuring
					contentEl.style.height = 'auto';
					contentEl.style.maxHeight = 'none';
					// force reflow
					const naturalHeight = contentEl.scrollHeight;
					if (expandedMap[String(rec._id)]) {
						// keep expanded notes showing full content
						contentEl.style.maxHeight = naturalHeight + 'px';
						contentEl.style.height = 'auto';
						contentEl.style.overflow = 'visible';
					} else {
						if (naturalHeight <= COLLAPSED_MAX) {
							// short content: size to content
							contentEl.style.maxHeight = naturalHeight + 'px';
							contentEl.style.height = 'auto';
							contentEl.style.overflow = 'visible';
						} else {
							// long content: cap at collapsed max and allow scrolling
							contentEl.style.maxHeight = COLLAPSED_MAX + 'px';
							contentEl.style.height = COLLAPSED_MAX + 'px';
							contentEl.style.overflow = 'auto';
						}
					}
				} catch (e) { /* ignore DOM set errors */ }
			});
			setShowExpandMap(prev => {
				const a = JSON.stringify(prev || {});
				const b = JSON.stringify(newMap || {});
				return a === b ? prev : newMap;
			});
		};
		compute();
		window.addEventListener('resize', compute);
		return () => window.removeEventListener('resize', compute);
	}, [records, iValues, editable, expandedMap]);

	const toggleExpand = (id) => {
		setExpandedMap(prev => {
			const currently = !!(prev && prev[id]);
			const next = !currently;
			// adjust the DOM element so the container expands immediately
			try {
				const wrapper = noteRefs.current[id];
				if (wrapper) {
					const contentEl = wrapper.querySelector('.editable-textarea-keynote');
					if (contentEl) {
						if (next) {
							// expand: set maxHeight to content height so it grows to show full content
							contentEl.style.maxHeight = contentEl.scrollHeight + 'px';
							contentEl.style.overflow = 'visible';
						} else {
							// collapse: restore collapsed max height and scrolling
							contentEl.style.maxHeight = COLLAPSED_MAX + 'px';
							contentEl.style.overflow = 'auto';
						}
					}
				}
			} catch (e) { /* ignore */ }
			return { ...(prev || {}), [id]: next };
		});
	};

	// start editing a kDate input programmatically and mark which id is editing
	const handleKDateEdit = (id) => {
		setEditKDateId(id);
		if (kDateEditRefs.current[id] && kDateEditRefs.current[id].current) {
			kDateEditRefs.current[id].current.start();
		}
	};
	
	// confirm/save the currently editing kDate and clear edit state
	const handleKDateConfirm = (id) => {
		if (kDateEditRefs.current[id] && kDateEditRefs.current[id].current) {
			kDateEditRefs.current[id].current.save();
		}
		setEditKDateId(null);
	};

    // Use IntersectionObserver on a sentinel element at the end of the list to trigger load-more.
    const sentinelRef = useRef(null);
    // only allow automatic load-more after user has interacted (scroll/wheel/touch)
    const userInteractedRef = useRef(false);

    useEffect(() => {
        // don't install observer until parent has completed the initial first-page load
        if (!initialLoadDone) return;
        if (typeof onLoadMore !== 'function') return;
         // determine the best root for the observer:
         // 1. use provided scrollContainerRef if present
         // 2. otherwise, try to find the nearest scrollable ancestor of containerRef
         // 3. fallback to null (viewport)
         let rootEl = (scrollContainerRef && scrollContainerRef.current) || null;
         if (!rootEl) {
            try {
                let p = containerRef && containerRef.current ? containerRef.current.parentElement : null;
                while (p && p !== document.body) {
                    const style = window.getComputedStyle(p);
                    const overflowY = style && style.overflowY;
                    if ((overflowY === 'auto' || overflowY === 'scroll') && p.scrollHeight > p.clientHeight) {
                        rootEl = p;
                        break;
                    }
                    p = p.parentElement;
                }
            } catch (e) { /* ignore DOM errors */ }
        }
        // rootEl remains null if viewport should be used
        console.debug('KeynoteList: chosen observer root', { rootEl });
         const options = {
             root: rootEl,
             rootMargin: '300px', // start loading when sentinel is within 300px
             threshold: 0
         };
        let observer = null;
        // helper to mark that the user interacted; only on first interaction do we allow auto-load
        const markUserInteracted = () => { userInteractedRef.current = true; };
        // attach interaction listeners to rootEl (or window) to detect user's intent to scroll
        try {
            const targetForEvents = rootEl || window;
            targetForEvents.addEventListener && targetForEvents.addEventListener('scroll', markUserInteracted, { passive: true });
            targetForEvents.addEventListener && targetForEvents.addEventListener('wheel', markUserInteracted, { passive: true });
            targetForEvents.addEventListener && targetForEvents.addEventListener('touchstart', markUserInteracted, { passive: true });
        } catch (e) { /* ignore */ }
        const cb = (entries) => {
            entries.forEach(entry => {
                console.debug('KeynoteList.observer callback', { isIntersecting: entry.isIntersecting, intersectionRatio: entry.intersectionRatio });
                if (entry.isIntersecting) {
                    // don't auto-trigger load-more until the user has interacted with the list
                    if (!userInteractedRef.current) return;
                     // throttle quick successive intersections
                     if (Date.now() - (lastScrollRef.current || 0) < 250) return;
                     lastScrollRef.current = Date.now();
                     if (hasMore && !loading) {
                         try { onLoadMore(); } catch (e) { /* ignore */ }
                     }
                 }
            });
            try {
                const sRect = sentinelRef.current && sentinelRef.current.getBoundingClientRect();
                const rRect = rootEl && rootEl.getBoundingClientRect ? rootEl.getBoundingClientRect() : null;
                console.debug('KeynoteList: sentinel and root rects', { sRect, rRect });
            } catch (e) { /* ignore */ }
        };
        try {
            observer = new IntersectionObserver(cb, options);
            console.debug('KeynoteList: created IntersectionObserver', { rootEl, options });
            if (sentinelRef.current) observer.observe(sentinelRef.current);
            console.debug('KeynoteList: observing sentinel', { sentinel: sentinelRef.current });
        } catch (e) {
            // fallback: nothing — keep previous scroll logs in dev builds
            console.warn('KeynoteList: IntersectionObserver failed, fallback to no-op', e);
        }
        return () => {
            try {
                if (observer && sentinelRef.current) { observer.unobserve(sentinelRef.current); console.debug('KeynoteList: unobserved sentinel'); }
                // remove interaction listeners
                const targetForEvents = rootEl || window;
                targetForEvents.removeEventListener && targetForEvents.removeEventListener('scroll', markUserInteracted);
                targetForEvents.removeEventListener && targetForEvents.removeEventListener('wheel', markUserInteracted);
                targetForEvents.removeEventListener && targetForEvents.removeEventListener('touchstart', markUserInteracted);
                observer = null;
            } catch (e) { }
        };
    }, [onLoadMore, hasMore, loading, scrollContainerRef, initialLoadDone]);

    // Fallback polling: check scroll position periodically in case IntersectionObserver doesn't trigger
    useEffect(() => {
        // don't poll for load-more until the initial page load finished
        if (!initialLoadDone) return;
        if (typeof onLoadMore !== 'function') return;
         let intervalId = null;
         const check = () => {
             try {
                 const el = (scrollContainerRef && scrollContainerRef.current) || containerRef.current || window;
                 let scrollPos, thresh;
                 if (el === window) {
                     scrollPos = window.innerHeight + window.scrollY;
                     thresh = document.body.offsetHeight - 300;
                 } else {
                     scrollPos = el.scrollTop + el.clientHeight;
                     thresh = el.scrollHeight - 200;
                 }
                 // throttle
                 if (Date.now() - (lastScrollRef.current || 0) < 500) return;
                // require user interaction before auto-check triggers load-more
                if (!userInteractedRef.current) return;
                 if (scrollPos >= thresh && hasMore && !loading) {
                     lastScrollRef.current = Date.now();
                     console.debug('KeynoteList.fallback check triggered onLoadMore', { scrollPos, thresh, hasMore, loading });
                     try { onLoadMore(); } catch (e) { /* ignore */ }
                 }
             } catch (e) { /* ignore */ }
         };
         // run immediately to catch initial short lists
         intervalId = setInterval(check, 700);
         // also run a single immediate check
         setTimeout(check, 50);
         return () => { if (intervalId) clearInterval(intervalId); };
     }, [onLoadMore, hasMore, loading, scrollContainerRef, initialLoadDone]);
    
     // Render records directly using stable keys (record._id) to ensure React reconciler updates correctly.
     return (
        <>
            {(records || []).map((record) => {
                const rid = String(record._id);
                return (
                    <div key={rid} className="row keynoteList">
                        <div>
                            <div className="k-note">
                                <div className="k-note-title">
                                    <Row id="k-note-date-row">
                                        <Col id="k-note-created-col" xs="2" style={{ paddingTop: '5px', textAlign: 'center' }}>
                                            {(() => {
                                                try {
                                                    const idStr = String(record._id || '');
                                                    const timestampHex = idStr.substring(0,8);
                                                    const created = new Date(parseInt(timestampHex, 16) * 1000);
                                                    return created.toLocaleDateString();
                                                } catch (e) {
                                                    return '';
                                                }
                                            })()}
                                        </Col>
                                        <Col id="k-note-date-col" className="k-note-date-col" xs="8" style={{ textAlign: 'left' }}>
                                            <Editable
                                                text={iValues["keynote"+rid+"time"]}
                                                placeholder={record.kDate || 'Title'}
                                                onSave={onSaveDate}
                                                type="input"
                                                edit={true}
                                                name={"keynote"+rid+"time"}
                                                keyId={rid}
                                                editControllerRef={kDateEditRefs.current[rid]}
                                                onEditStateChange={(isEditing) => {
                                                    if (isEditing) setEditKDateId(rid);
                                                    else setEditKDateId(prev => prev === rid ? null : prev);
                                                }}
                                            >
                                                <input
                                                    type="text"
                                                    name={"keynote"+rid+"time"}
                                                    className="editable-input form-control k-note-date-input"
                                                    placeholder={record.kDate || 'Title'}
                                                    defaultValue={iValues["keynote"+rid+"time"]}
                                                    data-key-id={rid}
                                                    onChange={handleChange}
                                                />
                                            </Editable>
                                        </Col>
                                        <Col id="k-note-edit-col" xs="1" style={{ textAlign: 'right' }}>
                                            {editKDateId === rid ? (
                                                <span style={{ cursor: 'pointer' }} onClick={() => handleKDateConfirm(rid)}>
                                                    <CheckIcon fontSize="1.2rem" />
                                                </span>
                                            ) : (
                                                <span style={{ cursor: 'pointer' }} onClick={() => handleKDateEdit(rid)}>
                                                    <CiEdit fontSize="1.2rem" />
                                                </span>
                                            )}
                                        </Col>
                                        <Col id="k-note-action-col" xs="1">
                                            <IconButton aria-label="delete" onClick={()=>removeKeynote(record._id)} size="small">
                                                <DeleteIcon fontSize="small" />
                                            </IconButton>
                                        </Col>
                                    </Row>
                                </div>
                                <div className={`note-display ${expandedMap[rid] ? 'expanded' : ''}`} ref={(el) => { noteRefs.current[rid] = el; }}>
                                    <Editable text={iValues["keynote"+rid+"note"]}
                                        placeholder={record.kContent || 'Notes'}
                                        type="textarea-keynote"
                                        onSave={onSaveContent}
                                        edit ={editable}
                                        keyId = {rid}
                                        hideIcon={true}
                                        editControllerRef={noteEditRefs.current[rid]}
                                        onEditStateChange={(isEditing) => { if (isEditing) setEditNoteId(rid); else setEditNoteId(prev => prev === rid ? null : prev); }}>
                                        <textarea
                                            name={"keynote"+rid+"note"}
                                            className="rounded py-2 px-3 text-gray-700 leading-tight whitespace-pre-wrap hover:shadow-outline editable-textarea-keynote"
                                            style={{ width: '100%', overflow: 'hidden', height: 'auto' }}
                                            placeholder={record.kContent || 'Notes'}
                                            rows="3"
                                            defaultValue={iValues["keynote"+rid+"note"]}
                                            onChange={handleChange}
                                            onFocus={autoResize}
                                            onInput={autoResize}
                                            />
                                    </Editable>

                                    {/* pencil/check button in the top-right of the note area */}
                                    {editable && (
                                        <div style={{ position: 'absolute', top: 6, right: 6, zIndex: 5 }}>
                                            {editNoteId === rid ? (
                                                <IconButton size="small" onClick={() => handleNoteConfirm(rid)} aria-label="confirm edit">
                                                    <CheckIcon />
                                                </IconButton>
                                            ) : (
                                                <IconButton size="small" onClick={() => handleNoteEdit(rid)} aria-label="edit note">
                                                    <CiEdit />
                                                </IconButton>
                                            )}
                                        </div>
                                    )}

                                    {/* expand/collapse button shown when static content overflows */}
                                    {showExpandMap[rid] && (
                                        <div className={`note-expand-btn ${expandedMap[rid] ? 'expanded' : ''}`}>
                                            <IconButton size="small" onClick={() => toggleExpand(rid)} aria-label="expand note">
                                                <ExpandMoreIcon className="expand-icon" />
                                            </IconButton>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })}
            {/* When more pages are available show a hint and a clickable load-more button.
                Keep the sentinel present but visually neutral so the IntersectionObserver still works. */}
            {initialLoadDone && !loading && (
                hasMore ? (
                    <div className="keynote-load-more">Scroll or Click to load more</div>
                ) : (
                    <div className="keynote-load-more">End of the Keynotes</div>
                )
            )}
             {/* sentinel element observed by IntersectionObserver to load more (hidden styling) */}
             <div ref={sentinelRef} style={{ width: '100%', height: 1 }} />
        </>
    );
};

export default KeynoteList;
