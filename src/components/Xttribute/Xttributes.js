import React from 'react';
import axios from 'axios';
import {useState,useRef,useEffect} from 'react';
import {API_BASE_URL, objDBName} from '../../constants/apiConstants';
import XttributesList from '../Layout/XttributesList';
import useUserSession from '../User/useUserSession';
function Xttributes(props){
	const {uid} = useUserSession();
	const[records, setRecords] =useState(0);
	props.updateTitle("Xttributes") 
	const handleLoad = () =>{
			if (uid!=null){
				const payload={
					"dbName": objDBName,
					"collName": "xttribute",
					"docContents": "{'uid':'" +uid + "'}",
					"operator" : "none",
					"returnType": "list",
					"sortBy": "_id",
					"limit":6,
					"order": "ASC"
					}
				axios.post(API_BASE_URL+'/getObjects?page=1', payload, )
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
			
		}
		useEffect(()=>{
		     handleLoad();
		 }, []); 
	return(
		<div className="container">
		    <XttributesList records={records} />
		 </div>	
	);
};
export default Xttributes