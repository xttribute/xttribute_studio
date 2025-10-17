import React , {useState,useRef,useEffect} from 'react';
import './XttributesList.css';
import Editable from '../InlineEdit/Editable';
import DeleteIcon from '@mui/icons-material/Delete';
import IconButton from '@mui/material/IconButton'
const KeynoteList = ({ records, onSaveDate, onSaveContent, onTextChange, removeKeynote, iValues, setIValues, editable, isEdit }) => {
	const textareaRef = useRef();
	const inputRef = useRef();
	const handleChange = ({ target }) => {
			setIValues(prevIValues => ({
			  ...prevIValues,
			  [target.name]: target.value
			}))
		}		
	const rows = [];
	  for (let i = 0; i < records.length; i += 1) {
	    const rowRecords = records.slice(i, i + 1);
		
	    const row = (
	      <div key={i} className="row" class ="keynoteList">
	        {rowRecords.map((record, j) => (
	          <div key={j} >	
				<div class="k-note">
					<div class="k-note-title">
						<Editable text={iValues["keynote"+record._id+"time"]} placeholder={record.kDate}
										childRef={inputRef} onSave={onSaveDate} type="input" edit ={ editable} name={"keynote"+record._id+"time"} keyId={record._id}>
										<form>
										<input ref={inputRef} type="text" name={"keynote"+record._id+"time"}
									    className="titleInput shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline border-blue-300"
										placeholder={record.kDate }
										value={iValues["keynote"+record._id+"time"]}
										data-key-id ={record._id}
									     onChange={handleChange}
										/></form>
										</Editable></div>
										<div>
										<Editable text={iValues["keynote"+record._id+"note"]}
											placeholder={record.kContent}
											childRef={textareaRef}
											type="textarea-keynote"
											onSave={onSaveContent}
											edit ={editable}
											keyId = {record._id}>
											<textarea ref={textareaRef}
											name={"keynote"+record._id+"note"}
											className="titleInput shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline border-blue-300"
											placeholder={record.kContent}
											rows="3"
											value={iValues["keynote"+record._id+"note"]}
											onChange={handleChange}
											/>
											</Editable>
										</div>
										{isEdit? 
										<div class="k-note-tool">	
										<IconButton aria-label="delete" onClick={()=>removeKeynote(record._id)}>
										  <DeleteIcon />
										  </IconButton>
										  </div>:''}			
								</div>
	          </div>
			  
	        ))}
	      </div>
	    );
	    rows.push(row);
	  }
	
	  return <div>{rows}</div>;
};

export default KeynoteList;