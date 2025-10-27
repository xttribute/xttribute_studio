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

function Xttribute(props) {
    props.updateTitle("Xttribute") 
    const {uid} = useUserSession();
    const {xid, setXID} = useXttribute();
    const {xuid, setXUID} = useXttribute();
    const [state, setState] = useState({
        sMessage: null
    })
    const {StoredFile} = useStoredFile();
    // Sidebar expand/collapse state
    const [sidebarExpanded, setSidebarExpanded] = useState(false);
    const toggleSidebar = () => setSidebarExpanded(expanded => !expanded);
    // active in-page tab (default to 'photos' so Photo panel opens on load)
    const [activeTab, setActiveTab] = useState('photos');
     // handle sidebar tab clicks (open an in-page tab instead of navigating)
     const handleSidebarTabSelect = (tab) => {
         setActiveTab(tab);
     }
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