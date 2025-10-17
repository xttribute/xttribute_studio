import React, {useState} from 'react';
import {API_BASE_URL, objDBName} from '../../constants/apiConstants';
import axios from 'axios';

function Pixel(props){
	
	 const payload={
	 				"dbName": objDBName,
	 				"collName": props.source,
	 				"docContents": "{'_id':'" +props._id + "', 'count':'" +props.count + "'}",
	 				"uKey" : "_id",
					"updateKey": props.action
	 				}
	 			axios.post(API_BASE_URL+'/updateStats', payload, )
	 			.then(function (response) {
	 				if(response.status === 200){			
	 					if(response.data.success=== 'view count updated'){
	 					
	 					}                 
	 				} else{
	 					props.showError("Oops! system error, it is on us, we are working on it!");
	 				}
	 			})
	 			.catch(function (error) {
	 				console.log(error);
	 			});    
	return(
		<div />
	);
}

export default Pixel;