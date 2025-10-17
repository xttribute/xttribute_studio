import React, {useState,useRef,useEffect} from 'react';
import Editable from '../InlineEdit/Editable';
import {API_BASE_URL, objDBName, CDNURL} from '../../constants/apiConstants';
import axios from 'axios';
import './Photo.css';
import Button from '@mui/material/Button';
import useXttribute from '../Xttribute/useXttribute';
import DeleteIcon from '@mui/icons-material/Delete';
import IconButton from '@mui/material/IconButton';
import SuccessMessage from '../AlertComponent/SuccessMessage';
import useUserSession from '../User/useUserSession';
import Photos from './Photos';
import PhotoLibraryOutlinedIcon from '@mui/icons-material/PhotoLibraryOutlined';
import { Resizable, ResizableBox } from "react-resizable";
import DropPhoto from './DropPhoto';
import {Row, Col} from 'reactstrap';
function Photo(props) {
	const {xid} = useXttribute();
	const {xuid} = useXttribute();
	const {uid} = useUserSession();
	const [state, setState] = useState({
			sMessage: null
		})
	const [iValues, setIValues] = useState({})
	const [photos, setPhotos] =useState([]);
	const[records, setRecords] =useState(0);
	const [page, setPage] = useState(1); // Track current page
	const [loading, setLoading] = useState(false); // Track loading state
	const [hasMore, setHasMore] = useState(true); // Track if more photos exist
	const photoListRef = useRef(null); // Ref for photo list container
	const loadingRef = useRef(loading);
	const handleLoad = (loadPage = 1) =>{
		if (xid!=null && !loading && hasMore) {
			setLoading(true);
			const payload={
				"dbName": objDBName,
				"collName": "photo",
				"docContents": "{'xid':'" +xid + "'}",
				"operator" : "none",
				"returnType": "list",
				"sortBy": "_id",
				"order": "DESC",
				"limit": 6
			}
			axios.post(API_BASE_URL+`/getObjects?page=${loadPage}` , payload)
			.then(function (response) {
				if(response.status === 200){
					if(response.data.doc_302=== 'Document matched'){
						const newPhotoList = response.data.objects || [];
						if (newPhotoList.length === 0) {
							setHasMore(false);
						} else {
							setRecords(prevRecords => loadPage === 1 ? newPhotoList : [...prevRecords, ...newPhotoList]);
							//setRecords(response.data.objects);
							newPhotoList.map(object =>{
								setIValues(prevIValues => loadPage ===1 ? newPhotoList :({
									...prevIValues,
									["vc_"+object._id]: object.view
								}))
							})
						}
					} else {
						setHasMore(false);
					}
				} else{
					props.showError("Oops! system error, it is on us, we are working on it!");
				}
				setLoading(false);
			})
			.catch(function (error) {
				console.log(error);
				setLoading(false);
			});
		}
	}
    
	// Debounce utility
	function debounce(func, wait) {
	  let timeout;
	  return function(...args) {
		clearTimeout(timeout);
		timeout = setTimeout(() => func.apply(this, args), wait);
	  };
	}

	// Infinite scroll handler
	const debouncedHandleScroll = debounce(() => {
		const container = photoListRef.current;
		if (!container || loadingRef.current || !hasMore) return;
		if (container.scrollHeight - container.scrollTop <= container.clientHeight + 50) {
		  loadingRef.current = true; // set immediately to block further triggers
		  setPage(prevPage => prevPage + 1);
		}
	}, 200);

	useEffect(() => {
		if (page === 1) handleLoad(1);
        else
		handleLoad(page);
	}, [page]);

	useEffect(() => {		
		const container = photoListRef.current;
		if (!container) return;
		container.addEventListener('scroll', debouncedHandleScroll);
		return () => container.removeEventListener('scroll', debouncedHandleScroll);
	}, []); // Attach only once
	
	useEffect(() => {
			loadingRef.current = loading;
		}, [loading]);

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
	async function AddNewPhoto() {
		
		if(photos.length>0){
		const payload={
			"dbName": objDBName,
			"collName": "photo",
			"docContents": "{'xid':'" +xid + "'}",
			"operator" : "none",
			"returnType": "list",
			"sortBy": "_id",
			"order": "DESC"
		}
		axios.post(API_BASE_URL+'/getObjects', payload, )
		.then(function (response) {
		if(response.status === 200){			
			if(response.data.doc_302=== 'Document matched'){
				setRecords(response.data.objects);
			}                 
		} else{
			props.showError("Oops! system error, it is on us, we are working on it!");
		}
		})
		.catch(function (error) {
			console.log(error);
		}); 
		 
		}	
		await sleep(1000); 
		const payload={
			"dbName": objDBName,
			"collName": "photo",
			"docContents": "{'xid':'" +xid + "','xuid':'" +xuid+ "'}",
			"uKey" : "0"
		}
		axios.post(API_BASE_URL+'/newObject', payload, )
		.then(function (response) {
			if(response.status === 200){			
				if(response.data.doc_201 === 'Document created'){
					 setNewphoto();
					 let ptId=response.data._id;
					 const titleName = "photo" + ptId + "title";
					  setPhotos([{ id: ptId, titleName: titleName}]);
				}                 
			} else{
				props.showError("Oops! system error, it is on us, we are working on it!");
			}
		})
		.catch(function (error) {
			console.log(error);
		});
		

	};	
	const [newphoto, setNewphoto] = useState("");
	let isEdit = false;
    if (props.editable =="t"){
		isEdit = true;
	}
	  return (
		<div>
		     {isEdit ? <div class="addButton"><Button class ="button-8" endIcon={<PhotoLibraryOutlinedIcon  fontSize="small" />} onClick={AddNewPhoto}>+ Photo</Button></div>:''}
			 <SuccessMessage successMessage={state.sMessage} />
			 <ul class="photoList" ref={photoListRef} style={{maxHeight: 600, overflowY: 'auto'}}>
			 {photos && photos.map((photo)=>(
				<ResizableBox className="resizebox" width={350} height={330} key={photo._id || photo.id}>
						<div class="newPhotoTitle">
						<Row>
						<Col>
						<Editable text={newphoto} placeholder={"About ... " }
						childRef={inputRef} onSave={savePTitle} type="input" edit ={props.editable} name={photo.titleName} keyId = {photo.id || photo._id}>
						<form>
						<input ref={inputRef} type="text" name={photo.titleName}
					    className="titleInput shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline border-blue-300"
						placeholder={"About ..."}
						value={newphoto}
						data-key-id ={photo.id || photo._id}
					     onChange={e => setNewphoto(e.target.value)}
						/></form>
						</Editable>
						</Col>
						<Col xs={2}>
						<IconButton aria-label="delete" onClick={()=>removePhoto(photo.id || photo._id)}>
							<DeleteIcon />
						 </IconButton>
						</Col>
						</Row>
						</div>
						<div class="photoDrop">
							<DropPhoto key={photo.id || photo._id} type="photo"
							folder="photo"
							showError = {props.showError}
							dbName="xtrObject"
							collName="photo"
							compId ={photo.id || photo._id}
							previewHeight="100%"
							/>								
						</div>	
								
				</ResizableBox>
			 ))}
		
			 <Photos records={records} onSaveTitle={savePTitle} 
			 ontextChange={handleChange} 
			 removePhoto= {removePhoto} iValues={iValues} setIValues={setIValues}
			 editable= {props.editable} isEdit={isEdit} />
		     </ul>
			 {loading && <li style={{textAlign:'center'}}>Loading...</li>}
				{!hasMore && <li style={{textAlign:'center', color:'#888'}}>No more photos</li>}
		   </div>
		);
}

export default Photo;