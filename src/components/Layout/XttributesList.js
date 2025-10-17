import React from 'react';
import './XttributesList.css';
import xttribute_no_image from '../../medias/images/xttribute_no_image.png';
import useXttribute from '../Xttribute/useXttribute';
import { useNavigate } from 'react-router-dom';
import {CDNURL} from '../../constants/apiConstants';
import useStoredFile from '../Dropzone/useStoredFile';
const XttributesList = ({ records }) => {
	const {xid, setXID} = useXttribute();
	const {StoredFile, setStoredFile} = useStoredFile();
	const {StoredURL,setStoredURL} = useStoredFile();
	const navigate = useNavigate();
	function navToXttribute(xid,thumbnail){
		setXID(xid);
		setStoredFile('<img src='+CDNURL+thumbnail+' class=imagePreview />');
		setStoredURL(CDNURL+thumbnail);
		navigate('/xttribute'); 
	}	
	const rows = [];
	  for (let i = 0; i < records.length; i += 3) {
	    const rowRecords = records.slice(i, i + 3);
	    const row = (
	      <div key={i} className="row">
	        {rowRecords.map((record, j) => (
				
	          <div key={j} className="col-4">
			  	<div class="polaroid" onClick={()=> navToXttribute(record._id,record.thumbnail)}>
			    	<img src={record.thumbnail? CDNURL+record.thumbnail: xttribute_no_image} alt="Norway" style={{'width':'100%'}} />
			    	<div class="container">
			      	<p>{record.name}</p>
					<p>{record.description}</p>
			    	</div>
				</div>
	          </div>
	        ))}
	      </div>
	    );
	    rows.push(row);
	  }
	
	  return <div>{rows}</div>;
};

export default XttributesList;