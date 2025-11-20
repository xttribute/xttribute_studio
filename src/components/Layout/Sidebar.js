import React from 'react';
import PropTypes from 'prop-types';
import parse from 'html-react-parser';
import logo from '../../medias/images/xttribute_logo.png';
import KeyboardDoubleArrowLeftOutlinedIcon from '@mui/icons-material/KeyboardDoubleArrowLeftOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import WebAssetOutlinedIcon from '@mui/icons-material/WebAssetOutlined';
import PhotoLibraryOutlinedIcon from '@mui/icons-material/PhotoLibraryOutlined';
import SummarizeOutlinedIcon from '@mui/icons-material/SummarizeOutlined';
import CategoryOutlinedIcon from '@mui/icons-material/CategoryOutlined';
import HearingOutlinedIcon from '@mui/icons-material/HearingOutlined';
import VideocamOutlinedIcon from '@mui/icons-material/VideocamOutlined';
import { PRIMARY_COLOR } from '../../constants/apiConstants';

function Sidebar({ expanded, onToggle, storedFile, name, log, onSidebarTabSelect }) {
    const [openMenu, setOpenMenu] = React.useState('assets');
    const handleParentClick = (menu) => {
        setOpenMenu(openMenu === menu ? null : menu);
    };
    // keep navigate require if other code expects it; not used here
    const navigate = require('react-router-dom').useNavigate();
    return (
        <div
            className={`sidebar${expanded ? ' expanded' : ''}`}
            style={{
                width: expanded ? 200 : 60,
                transition: 'width 0.2s',
                background: 'rgb(225, 236, 244)', // updated to requested color
                color: '#222',
                display: 'flex',
                flexDirection: 'column',
                alignItems: expanded ? 'flex-start' : 'center',
                paddingTop: 20,
                position: 'fixed',
                left: 0,
                top: 0,
                height: '100vh',
                zIndex: 2,
                justifyContent: 'flex-start'
            }}
        >
            {/* Render storedFile at the top of the sidebar */}
            <div style={{width: '100%', textAlign: 'center', marginBottom: 10}}>
                {storedFile && (
                    <div style={{display: 'flex', justifyContent: 'center'}}>
                        <div style={{height: expanded ? 125 : 60, width: expanded ? 125 : 60, overflow: 'hidden', borderRadius: 8, background: '#333'}}>
                            {parse(storedFile)}
                        </div>
                    </div>
                )}
                {/* Display name only when expanded */}
                {expanded && name && (
                    <div style={{marginTop: 10, fontWeight: 'bold', fontSize: 16, color: '#222'}}>{name}</div>
                )}
            </div>
            <button
                onClick={onToggle}
                style={{
                    background: 'none',
                    border: 'none',
                    color: '#222',
                    fontSize: 24,
                    marginBottom: 20,
                    cursor: 'pointer',
                    alignSelf: expanded ? 'flex-end' : 'center',
                    transition: 'all 0.2s'
                }}
                aria-label="Toggle menu"
            >
                {expanded ? <KeyboardDoubleArrowLeftOutlinedIcon /> : '\u2630'}
            </button>
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
               
           
                <div style={{ width: '100%' }}>
                    <div
                        style={{ padding: expanded ? '10px 20px' : '10px 0', cursor: 'pointer', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: expanded ? 'flex-start' : 'center', width: '100%' }}
                        onClick={() => handleParentClick('assets')}
                    >
                        <WebAssetOutlinedIcon style={{ fontSize: 20, marginRight: expanded ? 8 : 0, color: '#333' }} /> {expanded && 'Assets'}
                        {expanded && (openMenu === 'assets' ? <ExpandMoreIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />)}
                    </div>
                    {/* When expanded show labels; when collapsed show icon-only buttons so Photos/Keynotes are visible by default */}
                    {openMenu === 'assets' && (
                        expanded ? (
                            <div style={{ marginLeft: 32, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                                <div style={{ padding: '6px 0', cursor: 'pointer', fontSize: 13 }}
                                     onClick={() => onSidebarTabSelect && onSidebarTabSelect('photos')}>
                                    <PhotoLibraryOutlinedIcon style={{ fontSize: 18, verticalAlign: 'middle', marginRight: 6, color: PRIMARY_COLOR }} /> Photos
                                </div>
                                <div style={{ padding: '6px 0', cursor: 'pointer', fontSize: 13 }}
                                     onClick={() => onSidebarTabSelect && onSidebarTabSelect('keynotes')}>
                                    <SummarizeOutlinedIcon style={{ fontSize: 18, verticalAlign: 'middle', marginRight: 6, color: PRIMARY_COLOR }} /> Keynotes
                                </div>
                                <div style={{ padding: '6px 0', cursor: 'pointer', fontSize: 13 }}
                                     onClick={() => onSidebarTabSelect && onSidebarTabSelect('attributes')}>
                                    <CategoryOutlinedIcon style={{ fontSize: 18, verticalAlign: 'middle', marginRight: 6, color: PRIMARY_COLOR }} /> Attributes
                                </div>
                                <div style={{ padding: '6px 0', cursor: 'pointer', fontSize: 13 }}
                                     onClick={() => onSidebarTabSelect && onSidebarTabSelect('sounds')}>
                                    <HearingOutlinedIcon style={{ fontSize: 18, verticalAlign: 'middle', marginRight: 6, color: PRIMARY_COLOR }} /> Sounds
                                </div>
                                <div style={{ padding: '6px 0', cursor: 'pointer', fontSize: 13 }}
                                     onClick={() => onSidebarTabSelect && onSidebarTabSelect('videos')}>
                                    <VideocamOutlinedIcon style={{ fontSize: 18, verticalAlign: 'middle', marginRight: 6, color: PRIMARY_COLOR }} /> Videos
                                </div>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                                <button onClick={() => onSidebarTabSelect && onSidebarTabSelect('photos')} title="Photos" style={{background:'none',border:'none',cursor:'pointer',padding:6}}>
                                    <PhotoLibraryOutlinedIcon style={{ fontSize: 20, color: PRIMARY_COLOR }} />
                                </button>
                                <button onClick={() => onSidebarTabSelect && onSidebarTabSelect('keynotes')} title="Keynotes" style={{background:'none',border:'none',cursor:'pointer',padding:6}}>
                                    <SummarizeOutlinedIcon style={{ fontSize: 20, color: PRIMARY_COLOR }} />
                                </button>
                                <button onClick={() => onSidebarTabSelect && onSidebarTabSelect('attributes')} title="Attributes" style={{background:'none',border:'none',cursor:'pointer',padding:6}}>
                                    <CategoryOutlinedIcon style={{ fontSize: 20, color: PRIMARY_COLOR }} />
                                </button>
                                <button onClick={() => onSidebarTabSelect && onSidebarTabSelect('sounds')} title="Sounds" style={{background:'none',border:'none',cursor:'pointer',padding:6}}>
                                    <HearingOutlinedIcon style={{ fontSize: 20, color: PRIMARY_COLOR }} />
                                </button>
                                <button onClick={() => onSidebarTabSelect && onSidebarTabSelect('videos')} title="Videos" style={{background:'none',border:'none',cursor:'pointer',padding:6}}>
                                    <VideocamOutlinedIcon style={{ fontSize: 20, color: PRIMARY_COLOR }} />
                                </button>
                            </div>
                        )
                    )}
                 </div>
            </div>
            {/* Xttribute logo at the bottom */}
            <div style={{marginTop: 'auto', width: '100%', textAlign: 'center', padding: 10}}>
                <img
                    src={logo}
                    alt="Xttribute logo"
                    style={{
                        width: 40,
                        height: 40,
                        objectFit: 'contain',
                        margin: '0 auto',
                        display: 'block',
                        opacity: 0.8
                    }}
                />
            </div>
        </div>
    );
}

Sidebar.propTypes = {
    expanded: PropTypes.bool.isRequired,
    onToggle: PropTypes.func.isRequired,
    storedFile: PropTypes.string,
    name: PropTypes.string,
    log: PropTypes.string,
    onSidebarTabSelect: PropTypes.func
};

export default Sidebar;
