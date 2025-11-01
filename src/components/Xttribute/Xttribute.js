import React, {useState,useRef,useEffect} from 'react';
import axios from 'axios';
import './Xttribute.css';
import {API_BASE_URL, objDBName, CDNURL} from '../../constants/apiConstants';
import useUserSession from '../User/useUserSession';
import useXttribute from './useXttribute';
import useStoredFile from '../Dropzone/useStoredFile';
import AppMenu from '../Layout/AppMenu';
import Sidebar from '../Layout/Sidebar';
import Photo from '../Photo/Photo';
import Keynote from '../Keynote/Keynote';
import Attributes from '../Attributes/Attributes';
import { useLocation, useNavigate } from 'react-router-dom';

function Xttribute(props) {
    props.updateTitle("Xttribute") 
    const {uid} = useUserSession();
    const {xid, setXID} = useXttribute();
    const {xuid, setXUID} = useXttribute();
    const [state, setState] = useState({
        sMessage: null
    })
    const {StoredFile, setStoredFile, setStoredURL} = useStoredFile();
    // Sidebar expand/collapse state
    const [sidebarExpanded, setSidebarExpanded] = useState(false);
    const toggleSidebar = () => setSidebarExpanded(expanded => !expanded);
    // active in-page tab (default to 'photos' so Photo panel opens on load)
    const [activeTab, setActiveTab] = useState('photos');

    // Use react-router location so client-side navigation with query params updates activeTab
    const location = useLocation();
    const navigate = useNavigate();
    useEffect(() => {
        try {
            const params = new URLSearchParams(location.search || window.location.search);
            const tab = params.get('tab');
            if (tab && ['photos', 'keynotes', 'attributes'].includes(tab)) {
                setActiveTab(tab);
            }
        } catch (e) {
            // ignore malformed URL
        }
    }, [location.search]);
     // handle sidebar tab clicks (open an in-page tab instead of navigating)
     const handleSidebarTabSelect = (tab) => {
         // update UI
         setActiveTab(tab);
         try {
             // update the URL query param so users can share/link to the selected tab
             navigate(`?tab=${tab}`, { replace: true });
         } catch (e) {
             // ignore if navigation not available
         }
     }
    const handleLoad = () =>{
        if (!xid) return;
        const payload={
            dbName: objDBName,
            collName: 'xttribute',
            docContents: "{'_id':'" + xid + "'}",
            uKey: '_id'
        };

        axios.post(API_BASE_URL + '/getOneObject', payload)
        .then(function (response) {
            if (response.status !== 200) {
                props.showError("Oops! system error, it is on us, we are working on it!");
                return;
            }

            // Prefer explicit object payload if present; fall back to older doc_302 flag
            const obj = response.data && response.data.object ? response.data.object : (response.data && response.data.doc ? response.data.doc : null);
            if (obj) {
                setName(obj.name || '');
                setDescription(obj.description || '');
                if (obj.uid) setXUID(obj.uid);

                // update sidebar thumbnail if present
                try {
                    if (obj.thumbnail) {
                        const thumb = obj.thumbnail;
                        setStoredFile('<img src=' + CDNURL + thumb + ' class=imagePreview />');
                        setStoredURL(CDNURL + thumb);
                    } else {
                        // clear previous stored file when none exists
                        setStoredFile(null);
                        setStoredURL(null);
                    }
                } catch (e) {
                    // ignore
                }
            }
        })
        .catch(function (error) {
            console.log(error);
        });
    }
    // Load xttribute data whenever xid changes (covers client-side navigation and redirects)
    useEffect(()=>{
         handleLoad();
     }, [xid]); 
	
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
    
    return(
        <div className="xttribute-main-layout" style={{display: 'flex', minHeight: '100vh'}}>
            {/* Sidebar */}
            <Sidebar expanded={sidebarExpanded} onToggle={toggleSidebar} storedFile={StoredFile} name={name} log={"Xttribute log"} onSidebarTabSelect={handleSidebarTabSelect} />
            {/* Main content: AppMenu always shown; selected tab content rendered below it */}
          
                <div style={{padding: 16}}>
                     {activeTab === 'photos' ? (
                         <Photo showError={props.showError} editable={"t"} />
                     ) : activeTab === 'keynotes' ? (
                         <Keynote showError={props.showError} editable={"t"} />
                     ) : activeTab === 'attributes' ? (
                         <Attributes showError={props.showError} editable={"t"} />
                     ) : (
                         // default content for Xttribute main area
                         <div>
                             {/* existing main Xttribute content can go here */}
                         </div>
                     )}
                 </div>
             </div>
        
 
     )
 }
 
 export default Xttribute;