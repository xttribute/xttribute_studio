import React, {useState,useRef,useEffect} from 'react';
import Editable from '../InlineEdit/Editable';
import {API_BASE_URL, objDBName, CDNURL} from '../../constants/apiConstants';
import axios from 'axios';
import './Keynote.css';
import Button from '@mui/material/Button';
import useXttribute from '../Xttribute/useXttribute';
import DeleteIcon from '@mui/icons-material/Delete';
import IconButton from '@mui/material/IconButton';
import SuccessMessage from '../AlertComponent/SuccessMessage';
import useUserSession from '../User/useUserSession';
import KeynoteList from '../Layout/KeynoteList';
import SummarizeOutlinedIcon from '@mui/icons-material/SummarizeOutlined';
function Keynote(props) {
	const {xid} = useXttribute();
	const {xuid} = useXttribute();
	const {uid} = useUserSession();
	const [state, setState] = useState({
			sMessage: null
		})
	const [iValues, setIValues] = useState({})
	const [keynotes, setKeynotes] =useState([]);
	const[records, setRecords] =useState(0);	
	const handleLoad = () =>{
		if (xid!=null){
			const payload={
				"dbName": objDBName,
				"collName": "keynote",
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
						response.data.objects.map(object =>{
							setIValues(prevIValues => ({
									  ...prevIValues,
									  ["keynote"+object._id+"time"]: object.kDate
							}))
							setIValues(prevIValues => ({
									...prevIValues,
									["keynote"+object._id+"note"]: object.kContent
							}))
						})
					}                 
				} else{
					props.showError("Oops! system error, it is on us, we are working on it!");
				}
			})
			.catch(function (error) {
				console.log(error);
			});    
		}
				
				
	}
	useEffect(()=>{
		handleLoad();
	}, []); 
	//console.log(iValues);
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
	  					setState(prevState => ({
	  						...prevState,
	  						'sMessage' : 'Keynote date updated!'
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
		  					setState(prevState => ({
		  						...prevState,
		  						'sMessage' : 'Keynote content updated!'
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
					setKeynotes(keynotes.filter(keynote=> keynote.id !== id));
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
	function AddNewKeynote() {
		const payload={
			"dbName": objDBName,
			"collName": "keynote",
			"docContents": "{'xid':'" +xid + "','xuid':'" +xuid+ "'}",
			"uKey" : "0"
		}
		axios.post(API_BASE_URL+'/newObject', payload, )
		.then(function (response) {
			if(response.status === 200){			
				if(response.data.doc_201 === 'Document created'){
					 let knId=response.data._id;
					 const timeName = "keynote" + knId + "time";
					 const noteName =  "keynote" + knId + "note";
					  setKeynotes([...keynotes, { id: knId, timeName: timeName, noteName: noteName}]);
				}                 
			} else{
				props.showError("Oops! system error, it is on us, we are working on it!");
			}
		})
		.catch(function (error) {
			console.log(error);
		});
		

	};	
	let isEdit = false;
    if (props.editable =="t"){
		isEdit = true;
	}
	  return (
		<div>
		     {isEdit ? <div class="addButton"><Button class ="button-8" endIcon={<SummarizeOutlinedIcon  fontSize="small"/>} onClick={AddNewKeynote}>+ Keynote</Button></div>:''}
			 <SuccessMessage successMessage={state.sMessage} />  
		     <ul class="keynoteBox">
			 {keynotes? keynotes.map((keynote)=>(
				<div class="k-note">
						<div class="k-note-title">
						<Editable text={iValues[keynote.timeName]} placeholder={"@"+kDate + " [click to change]" }
						childRef={inputRef} onSave={saveKDate} type="input" edit ={props.editable} name={keynote.timeName} keyId = {keynote.id}>
						<form>
						<input ref={inputRef} type="text" name={keynote.timeName}
					    className="titleInput shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline border-blue-300"
						placeholder={"@" +kDate }
						value={iValues[keynote.timeName]}
						data-key-id ={keynote.id}
					     onChange={handleChange}
						/></form>
						</Editable></div>
						<div>
						<Editable text={iValues[keynote.noteName]}
							placeholder="Click to write a keynote "
							childRef={textareaRef}
							type="textarea-keynote"
							onSave={saveKContent}
							edit ={props.editable}
							keyId = {keynote.id}>
							<textarea ref={textareaRef}
							name={keynote.noteName}
							className="titleInput shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline border-blue-300"
							placeholder="Keynote ... "
							rows="3"
							value={iValues[keynote.noteName]}
							onChange={handleChange}
							/>
							</Editable>
						</div>
						{isEdit? 
						<div class="k-note-tool">	
						<IconButton aria-label="delete" onClick={()=>removeKeynote(keynote.id)}>
						  <DeleteIcon />
						  </IconButton>
						  </div>:''}			
				</div>
			 )):''}
			 <KeynoteList records={records} onSaveDate={saveKDate} 
			 onSaveContent= {saveKContent} ontextChange={handleChange} 
			 removeKeynote= {removeKeynote} iValues={iValues} setIValues={setIValues}
			 editable= {props.editable} isEdit={isEdit} />
		     </ul>
			
		   </div>
		   
		);
	  
}

export default Keynote;