import React, { useEffect, useState, useRef } from 'react';
import DropThumbnail from './DropThumbnail';
import {API_BASE_URL, objDBName, CDNURL} from '../../constants/apiConstants';
import axios from 'axios';
import useXttribute from './useXttribute';
import useUserSession from '../User/useUserSession';
import useStoredFile from '../Dropzone/useStoredFile';
import { Resizable, ResizableBox } from "react-resizable";
import { useNavigate } from 'react-router-dom';
import './newXttribute.css';
import {Row, Col, Container} from 'reactstrap';


const NewXttribute = ({ showError, updateTitle, changeBG }) => {
  useEffect(() => {
    if (updateTitle) updateTitle('New Attribute');
    // optionally set a background image via changeBG if provided
    if (changeBG) changeBG(null);
  }, []);

  const [name, setName] = useState('');
  const [editing, setEditing] = useState(true); // start in edit mode to encourage naming
  const [loading, setLoading] = useState(false);
  // track hover state for the pen icon so we can darken it on hover
  const [penHover, setPenHover] = useState(false);
  // single useXttribute hook instance — provides xid, setter and destroy function
  const { xid, xuid, setXID, destoryXID } = useXttribute();
  const { setStoredFile, setStoredURL } = useStoredFile();
  const navigate = useNavigate();
  const [localError, setLocalError] = useState(null);
  const [errorCountdown, setErrorCountdown] = useState(0); // seconds remaining
  // state for thumbnail analysis (progress + results)
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeProgress, setAnalyzeProgress] = useState(0);
  const [attributes, setAttributes] = useState(null);
  // success state and countdown
  const [localSuccess, setLocalSuccess] = useState(null);
  const [successCountdown, setSuccessCountdown] = useState(0);
  const { uid } = useUserSession();

  // Called by DropThumbnail after a successful upload. It will POST the file to the
  // image describe API, animate a progress bar while waiting, then format the
  // JSON response into attribute name/value pairs and show them in a table.
  const handleThumbnailUploaded = async (file) => {
    if (!file) return;
    // Save a preview to the sidebar immediately so the user sees the thumbnail after redirect
    try {
      const previewUrl = file.preview || (file && file.name ? URL.createObjectURL(file) : null);
      if (previewUrl) {
        setStoredFile('<img src='+previewUrl+' class=imagePreview />');
        setStoredURL(previewUrl);
      }
    } catch (e) {
      // ignore preview errors
    }
    setAttributes(null);
    setAnalyzing(true);
    setAnalyzeProgress(5);

    // small interval to animate progress until response comes back
    const tid = setInterval(() => {
      setAnalyzeProgress((p) => Math.min(85, Math.round(p + Math.random() * 8)));
    }, 400);

    try {
      const url = 'http://127.0.0.1:8000/api/image/describe/';
      const form = new FormData();
      form.append('image', file);

      const resp = await axios.post(url, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (ev) => {
          if (ev.total) {
            const pct = Math.round((ev.loaded / ev.total) * 100);
            setAnalyzeProgress((cur) => Math.max(cur, Math.min(95, pct)));
          }
        },
      });

      clearInterval(tid);
      setAnalyzeProgress(100);

      const data = resp && resp.data ? resp.data : {};
      // Format response into [{name, value}, ...]
      // If response contains nested objects, prefer formatting the second-level
      // key/value pairs instead of the top-level keys. If there is exactly one
      // top-level object, show its keys. If multiple top-level objects, flatten
      // their second-level keys and prefix with parentName.key to avoid collisions.
      const isObject = (v) => v && typeof v === 'object' && !Array.isArray(v);
      const topLevelObjectKeys = Object.keys(data).filter((k) => isObject(data[k]));

      let formatted = [];
      const formatValue = (v) => {
        if (v === null || v === undefined) return '';
        if (typeof v === 'object') return JSON.stringify(v);
        return String(v);
      };

      if (topLevelObjectKeys.length === 1) {
        // Use the single nested object as the attribute source; exclude confidence_estimate
        const obj = data[topLevelObjectKeys[0]] || {};
        formatted = Object.keys(obj)
          .filter((k) => k !== 'confidence_estimate')
          .map((k) => ({ name: k, value: formatValue(obj[k]) }));
      } else if (topLevelObjectKeys.length > 1) {
        // Multiple nested objects — flatten and prefix with parent.key; exclude confidence_estimate
        topLevelObjectKeys.forEach((parent) => {
          const obj = data[parent] || {};
          Object.keys(obj).forEach((k) => {
            if (k === 'confidence_estimate') return;
            formatted.push({ name: `${parent}.${k}`, value: formatValue(obj[k]) });
          });
        });
      } else {
        // No nested objects — fallback to top-level key/value pairs; exclude confidence_estimate
        formatted = Object.keys(data)
          .filter((k) => k !== 'confidence_estimate')
          .map((k) => ({ name: k, value: formatValue(data[k]) }));
      }

      setAttributes(formatted);
    } catch (e) {
      clearInterval(tid);
      console.error('Error describing image', e);
      handleError('Failed to read attributes from thumbnail');
    } finally {
      // give user a brief moment to see 100% before hiding the bar
      setTimeout(() => {
        setAnalyzing(false);
        setAnalyzeProgress(0);
      }, 600);
    }
  };
  
  // show an error both locally (inline) and via the parent showError callback
  const handleError = (msg) => {
    setLocalError(msg);
    // initialize 5 second countdown
    setErrorCountdown(5);
  };

  // show success message in light-blue box and start 5s countdown
  const handleSuccess = (msg) => {
    setLocalSuccess(msg);
    setSuccessCountdown(5);
  };

  // countdown effect: decrement once per second while errorCountdown > 0
  useEffect(() => {
    if (!localError) return undefined;
    if (errorCountdown <= 0) {
      // clear immediately if countdown is zero
      setLocalError(null);
      if (showError) showError(null);
      return undefined;
    }

    const id = setInterval(() => {
      setErrorCountdown((s) => {
        if (s <= 1) {
          // will clear on next render
          return 0;
        }
        return s - 1;
      });
    }, 1000);

    return () => clearInterval(id);
  }, [localError, errorCountdown, showError]);

  // countdown effect for success messages
  useEffect(() => {
    if (!localSuccess) return undefined;
    if (successCountdown <= 0) {
      setLocalSuccess(null);
      return undefined;
    }

    const id = setInterval(() => {
      setSuccessCountdown((s) => {
        if (s <= 1) return 0;
        return s - 1;
      });
    }, 1000);

    return () => clearInterval(id);
  }, [localSuccess, successCountdown]);

  // create xttribute by calling /newObject endpoint
  const createXttribute = async (newName) => {
    if (!newName || !newName.trim()) {
      handleError('Name is required');
      return;
    }
    setLoading(true);
    try {
      // If xid exists, perform an update using xid as the uKey
      if (xid && xid !== 'null') {
        const payload = {
          'dbName': 'xtrObject',
          'collName': 'xttribute',
          'docContents': "{'_id':'" +xid + "','name':'"+newName +"'}",
          'uKey': '_id',
		  'updateKey':'name'          
         };

         axios.post(API_BASE_URL + '/updateObject', payload)
           .then(function (response) {
             if (response.status === 200) {
               if (response.data && response.data.success === 'updated') {
              //   handleSuccess('Xttribute name updated');
               setName(newName);
               setEditing(false);
               setLocalError(null);
           
		  }
               if (showError) showError(null);
             } else {
               handleError('Error updating xttribute');
             }
           })
           .catch(function (error) {
             console.log(error);
             handleError('Error updating xttribute');
           });
         return;
       }

       // create new xttribute when xid not present
       const payload = {
         'dbName': 'xtrObject',
         'collName': 'xttribute',
         'docContents':"{'name':'"+newName +"','uid':'"+uid +"'}",
         'uKey': 'name',
       };

       axios.post(API_BASE_URL + '/newObject', payload)
         .then(function (response) {
           if (response.status === 200) {
             if (response.data && response.data.doc_302 === 'Document exists') {
               handleError('Xttribute name already existed');
               return;
             }
             if (response.data && (response.data.doc_201 === 'Document created' || response.data._id)) {
               setName(newName);
               setEditing(false);
               if (response.data._id) setXID(response.data._id);
               setLocalError(null);
               //handleSuccess('Xttribute created');
               if (showError) showError(null);
             } else {
               // fallback success
               setName(newName);
               setEditing(false);
               if (response.data && response.data._id) setXID(response.data._id);
               setLocalError(null);
               //handleSuccess('Xttribute name set');
               if (showError) showError(null);
             }
           } else {
             handleError('Error creating xttribute');
           }
         })
         .catch(function (error) {
           console.log(error);
           handleError('Error creating xttribute');
         });
      // Do not navigate here. Navigation will happen only after the user confirms
      // attributes and the backend returns success (handled in Confirm attributes).
     } catch (err) {
       handleError('Error creating xttribute');
     } finally {
       setLoading(false);
     }
   };

  // Use a ref to hold the latest destoryXID so the cleanup runs only on unmount.
  // If destoryXID function identity changes during the component's life we don't
  // want to run the cleanup early and unset xid while the user is still on the page.
  const destoryXIDRef = useRef(destoryXID);
  // If we navigate to /xttribute after confirming attributes we want to keep the xid
  // across pages. keepXIDRef will be set to true right before navigation.
  const keepXIDRef = useRef(false);
  useEffect(() => {
    destoryXIDRef.current = destoryXID;
  }, [destoryXID]);

  // clear xid when navigating away from this component
  useEffect(() => {
    return () => {
      try {
        // Only destroy xid if we are not intentionally keeping it (e.g. when
        // navigating to /xttribute after confirming attributes).
        if (!keepXIDRef.current && typeof destoryXIDRef.current === 'function') destoryXIDRef.current();
      } catch (e) {
        // ignore
      }
    };
  }, []);

  // keep the existing handleSubmit to satisfy form onSubmit but delegate to create
  const handleSubmit = (e) => {
    e.preventDefault();
    // If still editing, confirm the name
    if (editing) {
      createXttribute(name);
    }
  };
  return (
    <div className="new-attribute-page mainBody">
      {/* heading removed per request */}
      <form onSubmit={handleSubmit}>
        {/* inline/local error displayed on top of action component */}
        {localError && (
          // floating overlay so it sits above the page content
          <div style={{position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 1060, width: 'min(90%, 600px)'}}>
            <div className="alert alert-danger d-flex flex-column align-items-center" role="alert">
              {/* center the message horizontally */}
              <div className="w-100 text-center">{localError}</div>
              <div className="progress mt-2" style={{height:6}}>
                <div
                  className="progress-bar bg-danger"
                  role="progressbar"
                  style={{width: `${(errorCountdown / 5) * 100}%`, transition: 'width 1s linear'}}
                  aria-valuenow={errorCountdown}
                  aria-valuemin="0"
                  aria-valuemax="5"
                />
              </div>
            </div>
          </div>
        )}
        {localSuccess && (
          <div className="mb-3">
            <div className="alert d-flex flex-column align-items-center" role="alert" style={{backgroundColor: '#e7f5ff', borderColor: '#bfe7ff'}}>
              {/* center the message horizontally and keep the blue text color */}
              <div className="w-100 text-center" style={{color: '#0366d6'}}>{localSuccess}</div>
              <div className="progress mt-2" style={{height:6}}>
                <div
                  className="progress-bar"
                  role="progressbar"
                  style={{width: `${(successCountdown / 5) * 100}%`, transition: 'width 1s linear', backgroundColor: '#7fc5ff'}}
                  aria-valuenow={successCountdown}
                  aria-valuemin="0"
                  aria-valuemax="5"
                />
              </div>
            </div>
          </div>
        )}
        <div className="mb-3">
          <label className="form-label">Create a xttribute</label>

          {/* Inline edit: show name or placeholder. Click edit to change. */}
          {!editing ? (
            // center the name + pen icon horizontally
            <div className="d-flex align-items-center justify-content-center w-100">
              <span style={{ marginRight: 6, textAlign: 'center' }}>{name || <em>Unnamed xttribute</em>}</span>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={() => setEditing(true)}
                title="Edit"
                aria-label="Edit"
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setPenHover(true)}
                onMouseLeave={() => setPenHover(false)}
                style={{ padding: '4px 8px', border: 'none', background: 'transparent', boxShadow: 'none', outline: 'none', color: penHover ? '#024ea8' : '#0366d6' }}
              >
                {/* Inline pen/pencil SVG icon — no extra dependency */}
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12.3 1.7a1 1 0 0 1 1.4 1.4l-8.2 8.2a1 1 0 0 1-.5.3l-3 1a.5.5 0 0 1-.6-.6l1-3a1 1 0 0 1 .3-.5l8.2-8.2z" />
                  <path d="M11 2l3 3" />
                </svg>
              </button>
            </div>
          ) : (
            // center the input + confirm button horizontally
            <div className="d-flex align-items-center justify-content-center w-100">
              <input
                className="form-control"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter xttribute name"
                disabled={loading}
                style={{ marginRight: 8, maxWidth: 320 }}
              />
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => createXttribute(name)}
                disabled={loading}
                title="Confirm name"
              >
                ✓
              </button>
            </div>
          )}
        </div>

        {/* only show Dropzone after the xttribute is created and xid is set */}
    
        { (xid && xid != 'null') ? (
			<Container id="afterName" fluid className="d-flex flex-column align-items-center">
			<Row><Col xs={12}>
			<ResizableBox className="resizebox" width={500} height={450} >
	         
	 	   <div className="newThumbnailTitle">Drag & drop to add a thumbnai for this xttribute</div>
                  <DropThumbnail
                    type="thumbnail"
                    folder="thumbnail"
                    dbName="xtrObject"
                    collName="xttribute"
                    handleError={handleError}
                    onThumbnailUploaded={handleThumbnailUploaded}
                    compId={xid}
                    previewHeight="100%"
                  />

                 {/* animated progress bar shown while image description is in progress */}
	 </ResizableBox>
	 </Col></Row>
	 <Row><Col xs={12}>
                 {analyzing && (
                   <div style={{marginTop:12}}>
                     <div style={{fontWeight:600, marginBottom:6}}>Reading attributes from your thumbnail.</div>
                     <div className="progress" style={{height:10}}>
                       <div
                         className="progress-bar progress-bar-striped progress-bar-animated"
                         role="progressbar"
                         style={{width: `${analyzeProgress}%`}}
                         aria-valuenow={analyzeProgress}
                         aria-valuemin="0"
                         aria-valuemax="100"
                       />
                     </div>
                   </div>
                 )}
	</Col></Row>
	
             {attributes && attributes.length > 0 && (
                <Row><Col xs={12}>
                  {/* Scrollable attribute list */}
                  <div id="attributeList" style={{marginTop:12, overflow:'auto', maxHeight:200, width:'100%'}}>
                    <table className="table table-sm table-bordered">
                      <thead>
                        <tr>
                          <th style={{width:'45%'}}>Attribute</th>
                          <th>Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {attributes.map((a) => (
                          <tr key={a.name}>
                            <td style={{wordBreak:'break-word'}}>{a.name}</td>
                            <td style={{wordBreak:'break-word'}}>{a.value}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Confirm attributes button + helper text moved outside the scrollable area */}
                  <div style={{marginTop:8, textAlign:'center'}}>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={async () => {
                        if (!xid || xid === 'null') {
                          handleError('Missing xid - cannot create attributes');
                          return;
                        }
                        setLoading(true);
                        try {
                          const pairs = attributes || [];
                          let contents = "{'xid':'" + xid + "'";
                          if (xuid) contents += ", 'xuid':'" + xuid + "'";
                          pairs.forEach((p) => {
                            const key = String(p.name).replace(/'/g, "\\'");
                            const val = (p.value === null || typeof p.value === 'undefined') ? '' : String(p.value).replace(/'/g, "\\'");
                            contents += ", '" + key + "':'" + val + "'";
                          });
                          contents += "}";

                          const payload = {
                            dbName: 'xtrObject',
                            collName: 'attribute',
                            docContents: contents,
                            uKey: '0'
                          };

                          const resp = await axios.post(API_BASE_URL + '/newObject', payload);
                          if (resp && resp.status === 200 && (resp.data && (resp.data.doc_201 === 'Document created' || resp.data._id))) {
                            // success - keep xid and navigate client-side to /xttribute with attributes tab active
                            keepXIDRef.current = true;
                            navigate('/xttribute?tab=attributes');
                            return;
                          } else if (resp && resp.data && resp.data.doc_302 === 'Document exists') {
                            // If document exists, still navigate but keep xid
                            keepXIDRef.current = true;
                            navigate('/xttribute?tab=attributes');
                            return;
                          } else {
                            handleError('Failed to create attributes');
                          }
                        } catch (err) {
                          console.error('Confirm attributes error', err);
                          handleError('Failed to create attributes');
                        } finally {
                          setLoading(false);
                        }
                      }}
                      disabled={loading}
                    >
                      Confirm attributes
                    </button>
                    <div style={{marginTop:6, color:'#666', fontSize:12}}>
                      You can update, delete or add the attributes after your confirmation
                    </div>
                  </div>
                </Col></Row>
             )}
           </Container>
         ) : null}
       </form>
     </div>
   );
 }

 export default NewXttribute;