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
import Sound from '../Sound/sound';
import Video from '../Video/video';
import Product from '../Product/product';
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
            // accept 'products' as well (gens -> products)
            if (tab && ['photos', 'keynotes', 'attributes', 'sounds', 'videos', 'products'].includes(tab)) {
                setActiveTab(tab);
            }
        } catch (e) {
            // ignore malformed URL
        }
    }, [location.search]);
     // handle sidebar tab clicks (open an in-page tab instead of navigating)
     const handleSidebarTabSelect = (tab) => {
         // update UI
         // Sidebar sends 'gens_products' for the Gens -> Products menu; map it to 'products'
         const mapped = tab === 'gens_products' ? 'products' : tab;
         setActiveTab(mapped);
         try {
             // update the URL query param so users can share/link to the selected tab
             navigate(`?tab=${mapped}`, { replace: true });
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
    
    // Hide the global window scrollbar while this view is active so internal container handles scrolling
    useEffect(() => {
        if (typeof document !== 'undefined') {
            const prevBodyOverflow = document.body.style.overflow;
            const prevHtmlOverflow = document.documentElement.style.overflow;
            document.body.style.overflow = 'hidden';
            document.documentElement.style.overflow = 'hidden';
            return () => {
                document.body.style.overflow = prevBodyOverflow || '';
                document.documentElement.style.overflow = prevHtmlOverflow || '';
            };
        }
        return undefined;
    }, []);

    return(
        <div className="xttribute-main-layout" style={{display: 'flex', minHeight: '100vh'}}>
            {/* Sidebar */}
            <Sidebar expanded={sidebarExpanded} onToggle={toggleSidebar} storedFile={StoredFile} name={name} log={"Xttribute log"} onSidebarTabSelect={handleSidebarTabSelect} />
            {/* Main content: AppMenu always shown; selected tab content rendered below it */}
          
                <div style={{padding: 16, width: '100%', overflowY: 'auto'}}>
                  
                     {activeTab === 'photos' ? (
                         <Photo showError={props.showError} editable={"t"} />
                     ) : activeTab === 'keynotes' ? (
                         <Keynote showError={props.showError} editable={"t"} />
                     ) : activeTab === 'sounds' ? (
                         <Sound showError={props.showError} editable={"t"} />
                     ) : activeTab === 'videos' ? (
                         <Video showError={props.showError} editable={"t"} />
                     ) : activeTab === 'products' ? (
                         <Product showError={props.showError} editable={"t"} name={name} />
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