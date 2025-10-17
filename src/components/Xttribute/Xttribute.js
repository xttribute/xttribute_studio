import React, {useState,useRef,useEffect} from 'react';
import axios from 'axios';
import './Xttribute.css';
import {API_BASE_URL, objDBName, CDNURL} from '../../constants/apiConstants';
import {Row, Col, Container} from 'reactstrap';
import useUserSession from '../User/useUserSession';
import useXttribute from './useXttribute';
import Editable from '../InlineEdit/Editable';
import SuccessMessage from '../AlertComponent/SuccessMessage';
import Dropzone from '../Dropzone/Dropzone';
import useStoredFile from '../Dropzone/useStoredFile';
import AppMenu from '../Layout/AppMenu';
import parse from 'html-react-parser'; 
function Xttribute(props) {
	props.updateTitle("Xttribute") 
	const {uid} = useUserSession();
	const {xid, setXID} = useXttribute();
	const {xuid, setXUID} = useXttribute();
	const [state, setState] = useState({
		sMessage: null
	})
	const {StoredFile} = useStoredFile();
	//console.log(StoredURL);
	//props.changeBG(StoredURL);
	const handleLoad = () =>{
		if (xid!=null){
			const payload={
				"dbName": objDBName,
				"collName": "xttribute",
				"docContents": "{'_id':'" +xid + "'}",
				"uKey" : "_id"
				}
			axios.post(API_BASE_URL+'/getOneObject', payload, )
			.then(function (response) {
				if(response.status === 200){			
					if(response.data.doc_302=== 'Document exists'){
						setName(response.data.object.name);
						setDescription(response.data.object.description);
						setXUID(response.data.object.uid);
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
	
	const handleSaveName = (text) => {
		if(xid==null){
			const payload={
				"dbName": objDBName,
				"collName": "xttribute",
				"docContents": "{'name':'" +name + "','uid':'" +uid+ "'}",
				"uKey" : "name"
			}
			axios.post(API_BASE_URL+'/newObject', payload, )
			.then(function (response) {
				if(response.status === 200){			
			    	if(response.data.doc_201 === 'Document created'){
					setXID(response.data._id);
					setState(prevState => ({
						...prevState,
						'sMessage' : 'New xttribute created!'
					}))
					}                 
			   	} else{
			    	props.showError("Oops! system error, it is on us, we are working on it!");
			    }
			 })
			 .catch(function (error) {
			 	console.log(error);
			 });    
		}else{
			const editPayload={
				"dbName": objDBName,
				"collName": "xttribute",
				"docContents": "{'_id':'" +xid + "','name':'" +name + "'}",
				"uKey" :"_id",
				"updateKey" : "name"
				}
				axios.post(API_BASE_URL+'/editObject', editPayload, )
				.then(function (response) {
					if(response.status === 200){			
						if(response.data.doc_202 === 'Document updated'){
							setState(prevState => ({
								...prevState,
								'sMessage' : 'Name updated!'
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
	}
	const handleSaveDescription = (text) => {
		const editPayload={
			"dbName": objDBName,
			"collName": "xttribute",
			"docContents": "{'_id':'" +xid + "','description':'" +description + "'}",
			"uKey" :"_id",
			"updateKey" : "description"
			}
		axios.post(API_BASE_URL+'/editObject', editPayload, )
		.then(function (response) {
			if(response.status === 200){			
				if(response.data.doc_202 === 'Document updated'){
					setState(prevState => ({
						...prevState,
						'sMessage' : 'Description updated!'
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
	
	
	let editable = "f";
	if(uid==xuid){
		editable = "t";
		//console.log(editable);
	}
	const inputRef = useRef();
	const textareaRef = useRef();
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	
    return(
        <div className="">
            <form>
			<Container>
				<Row>
					<Col className="" xs={2} >
					{editable ==='t'?
						<div class="thumbnailBox">
							<Dropzone type="thumbnail"
								folder="thumbnail"
								dbName="xtrObject"
								collName="xttribute"
								previewHeight="100px"
							/>								
						</div>	
					:<div>{parse (StoredFile)}</div>}					
					</Col>
					<Col xs={9}>
		                <div className="form-group text-left box">
						<Editable
						           text={name}
						           placeholder="Name your new xttribute"
						           childRef={inputRef}
								   onSave={handleSaveName}
						           type="input"
								   edit ={editable}
								   boldText ="yes"
						         >
						           <input
						             ref={inputRef}
						             type="text"
						             name="name"
						             className="titleInput shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline border-blue-300"
						             placeholder="Name your new xttribute"
						             value={name}
						             onChange={e => setName(e.target.value)}
						           />
					 </Editable>
					 </div>
					 					
					 					{xid ?
					 	                <div className="form-group text-left areaBox">				
					 						<Editable
					 					           text={description}
					 					           placeholder="Describe your xttribute "
					 					           childRef={textareaRef}
					 					           type="textarea"
					 							   onSave={handleSaveDescription}
					 							   edit ={editable}
					 					         >
					 					           <textarea
					 					             ref={textareaRef}
					 					             name="description"
					 					             className="titleInput shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline border-blue-300"
					 					             placeholder="Describe your xttribute"
					 					             rows="3"
					 					             value={description}
					 					             onChange={e => setDescription(e.target.value)}
					 					           />
					 					      </Editable>
					 	                </div>
										:''}
		            
						</Col>
					</Row>
			</Container>
            </form>
			<SuccessMessage successMessage={state.sMessage} />  
			<AppMenu showError = {props.showError}
			editable ={editable}/>
			
        </div>
    )
}

export default Xttribute;