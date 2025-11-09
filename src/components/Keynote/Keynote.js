import React, {useState,useRef,useEffect} from 'react';
import Editable from '../InlineEdit/Editable';
import {API_BASE_URL, objDBName, CDNURL} from '../../constants/apiConstants';
import axios from 'axios';
import './Keynote.css';
import Button from '@mui/material/Button';
import '../common.css';
import useXttribute from '../Xttribute/useXttribute';
import DeleteIcon from '@mui/icons-material/Delete';
import IconButton from '@mui/material/IconButton';
import SuccessMessage from '../AlertComponent/SuccessMessage';
import useUserSession from '../User/useUserSession';
import KeynoteList from '../Layout/KeynoteList';
import SummarizeOutlinedIcon from '@mui/icons-material/SummarizeOutlined';
import PhotoLibraryOutlinedIcon from '@mui/icons-material/PhotoLibraryOutlined';
import { useLocation } from 'react-router-dom';
function Keynote(props) {
    const location = useLocation();
    // call the hook once and destruct both values to avoid duplicate hook calls
    const { xid, xuid } = useXttribute();
	const {uid} = useUserSession();
	const [state, setState] = useState({
			sMessage: null
		})
	const [iValues, setIValues] = useState({})
	const [records, setRecords] =useState([]);

	const textareaRef = useRef();
	const inputRef = useRef();
	const [focusKDateId, setFocusKDateId] = useState(null);
	// ref for the actual scroll container (passed to KeynoteList so it observes the right element)
	const scrollContainerRef = useRef(null);

	// Ensure scrollContainerRef element is scrollable (runtime fallback in case CSS doesn't apply)
	useEffect(() => {
		try {
			const el = scrollContainerRef.current;
			if (el) {
				el.style.overflowY = el.style.overflowY || 'auto';
				el.style.WebkitOverflowScrolling = el.style.WebkitOverflowScrolling || 'touch';
				console.debug('Keynote: applied scroll styles to scrollContainerRef', { el });
			}
		} catch (e) { console.warn('Keynote: failed to apply scroll container styles', e); }
	}, []);

	// pagination / infinite scroll state
	const [page, setPage] = useState(1);
	const [hasMore, setHasMore] = useState(true);
	const pageSize = 8; // items per page (changed from 8)

	const fetchKeynotes = async (requestedPage = 1, append = false) => {
		if (!xid) return;
		// don't fetch pages >1 until the initial first-page load completes
		if (requestedPage !== 1 && !initialLoadDone) {
			console.debug('Keynote.fetchKeynotes prevented: initial load not done', { requestedPage });
			return;
		}
		// prevent duplicate concurrent fetches for the same page
		if (!fetchInFlightRef.current) fetchInFlightRef.current = new Set();
		if (fetchInFlightRef.current.has(requestedPage)) {
			console.debug('Keynote.fetchKeynotes prevented: already fetching page', { requestedPage });
			return;
		}
		fetchInFlightRef.current.add(requestedPage);
		console.debug('Keynote.fetchKeynotes start', { requestedPage, append, xid });
		// if requesting first page, reset hasMore
		if (requestedPage === 1) setHasMore(true);
		if (!hasMore && requestedPage !== 1) return;
		setLoading(true);
		try {
			const payload = {
				"dbName": objDBName,
				"collName": "keynote",
				"docContents": "{'xid':'" +xid + "'}",
				"operator" : "none",
				"returnType": "list",
				"sortBy": "_id",
				"order": "DESC",
				"limit": pageSize
			}
			const response = await axios.post(API_BASE_URL+`/getObjects?page=${requestedPage}`, payload);
			console.debug('Keynote.fetchKeynotes response status', response && response.status);
			if (response.status === 200 && response.data && response.data.doc_302 === 'Document matched') {
				const objects = response.data.objects || [];
				console.debug('Keynote.fetchKeynotes got objects', objects.length);
				if (append) {
					setRecords(prev => {
						// avoid duplicates by id
						const existingIds = new Set((prev || []).map(r => String(r._id)));
						const newOnes = objects.filter(o => !existingIds.has(String(o._id)));
						return [...(prev || []), ...newOnes];
					});
				} else {
					setRecords(objects);
				}
				// build iValues for any newly received objects (only for first page or appended ones)
				setIValues(prev => {
					const next = { ...(prev || {}) };
					objects.forEach(object =>{
						next["keynote"+object._id+"time"] = next["keynote"+object._id+"time"] || object.kDate;
						next["keynote"+object._id+"note"] = next["keynote"+object._id+"note"] || object.kContent;
					});
					return next;
				});

				// determine if there are more pages
				if (objects.length < pageSize) {
					setHasMore(false);
				} else {
					setHasMore(true);
				}
				// update current page if append
				if (append) setPage(requestedPage);
			} else {
				if (!append) setRecords([]);
			}
		} catch (e) {
			console.log(e);
		} finally {
			setLoading(false);
			try { fetchInFlightRef.current.delete(requestedPage); } catch(e) {}
			// mark initialLoadDone when first page fetch completes
			if (requestedPage === 1) {
				setInitialLoadDone(true);
			}
		}
	}
	// ref to track in-flight page fetches
	const fetchInFlightRef = useRef(new Set());

	const [loading, setLoading] = useState(false);
	// track whether the initial first-page fetch has completed
	const [initialLoadDone, setInitialLoadDone] = useState(false);
 
 	// Consolidated effect: fetch first page once when xid is available or when route pathname changes.
 // Having multiple effects caused duplicate fetchKeynotes calls (page 1 multiple times and simultaneous
 // requests for page 2/3). This single effect prevents that.
 useEffect(() => {
     if (!xid) return;
     setPage(1);
     // reset initialLoadDone while (re)loading page 1
     setInitialLoadDone(false);
     fetchKeynotes(1, false);
 }, [xid, location && location.pathname]);
 
	// parent load-more handler debug
	// onLoadMore handler used by KeynoteList (which observes its own scroll)
	const handleLoadMore = () => {
		console.debug('Keynote.handleLoadMore called', { page, hasMore, loading });
		if (!hasMore || loading) return;
		const nextPage = page + 1;
		fetchKeynotes(nextPage, true).catch(() => {});
	};

	const handleChange = ({ target }) => {
		setIValues(prevIValues => ({
		  ...prevIValues,
		  [target.name]: target.value
		}))
	}				
	const saveKDate = (text, keyId) => {
		const editPayload={
			"dbName": objDBName,
			"collName": "keynote",
			"docContents": "{'_id':'" +keyId + "','kDate':'" +text + "'}",
			"uKey" :"_id",
			"updateKey" : "kDate"
			}
		axios.post(API_BASE_URL+'/editObject', editPayload, )
		.then(function (response) {
			if(response.status === 200){
				if(response.data.doc_202 === 'Document updated'){

				}
			} else{
				props.showError("Oops! system error, it is on us, we are working on it!");
			}
		})
		.catch(function (error) {
			console.log(error);
		});							
	}
	const saveKContent = (text, keyId) => {
			const editPayload={
				"dbName": objDBName,
				"collName": "keynote",
				"docContents": "{'_id':'" +keyId + "','kContent':'" +text + "'}",
				"uKey" :"_id",
				"updateKey" : "kContent"
				}
			axios.post(API_BASE_URL+'/editObject', editPayload, )
			.then(function (response) {
				if(response.status === 200){
					if(response.data.doc_202 === 'Document updated'){

					}
				} else{
					props.showError("Oops! system error, it is on us, we are working on it!");
				}
			})
			.catch(function (error) {
				console.log(error);
			});
	}			
		const removeKeynote =(id) =>{
		console.log(id);
		const payload={
			"dbName": objDBName,
			"collName": "keynote",
					"docContents": "{'_id':'" +id + "'}",
					"uKey" : "_id"
		}
		axios.post(API_BASE_URL+'/removeObject', payload, )
		.then(function (response) {
			if(response.status === 200){
				if(response.data.doc_204 === 'Document deleted'){
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
	 const AddNewKeynote = async () => {
        const payload = {
            "dbName": objDBName,
            "collName": "keynote",
            "docContents": "{'xid':'" + xid + "','xuid':'" + xuid + "'}",
            "uKey": "0"
        };
        try {
            const response = await axios.post(API_BASE_URL + '/newObject', payload);
            if (response.status === 200) {
                if (response.data.doc_201 === 'Document created') {
                    let knId = response.data._id;
                    // refresh list - reset to first page to include the new item
                    try { setPage(1); await fetchKeynotes(1, false); } catch(e){}

                    // focus the newly created keynote's date input for editing
                    setFocusKDateId(String(knId));
                    // clear focus marker after a short delay so future creates can re-focus
                    setTimeout(() => setFocusKDateId(null), 3000);
                }
            } else {
                props.showError("Oops! system error, it is on us, we are working on it!");
            }
        } catch (error) {
            console.log(error);
        }
    };

	let isEdit = false;
    if (props.editable =="t"){
		isEdit = true;
	}
	  return (
		<div className="keynoteContainer" ref={scrollContainerRef} style={{ height: '95vh', maxHeight: '95vh', overflowY: 'auto' }}>
		     {isEdit && (
                 <div className="addButton">
                     <Button className="button-8 add-button-plain" endIcon={<PhotoLibraryOutlinedIcon fontSize="small" />} onClick={AddNewKeynote} variant="text" disableElevation disableRipple>
                         + Keynote
                     </Button>
                 </div>
             )}
			 <SuccessMessage successMessage={state.sMessage} />  
		     <ul className="keynoteBox">
                 <KeynoteList records={records} onSaveDate={saveKDate} 
             onSaveContent= {saveKContent} onTextChange={handleChange} 
             removeKeynote= {removeKeynote} iValues={iValues} setIValues={setIValues}
             editable= {props.editable} isEdit={isEdit} focusKDateId={focusKDateId}
             onLoadMore={handleLoadMore} hasMore={hasMore} loading={loading} scrollContainerRef={scrollContainerRef} initialLoadDone={initialLoadDone} />
             </ul>
			{loading && <div style={{textAlign:'center'}}>Loading...</div>}
		</div>
    
    );
  
}

export default Keynote;
