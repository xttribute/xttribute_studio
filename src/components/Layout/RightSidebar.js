import React from 'react';
import PropTypes from 'prop-types';
import avatar from '../../medias/images/avatar.png';
import useUserSession from '../User/useUserSession';
import { useNavigate } from 'react-router-dom';
import LoginOutlinedIcon from '@mui/icons-material/LoginOutlined';
import KeyboardDoubleArrowRightOutlinedIcon from '@mui/icons-material/KeyboardDoubleArrowRightOutlined';
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined';
import Avatar from '@mui/material/Avatar';
import BorderStyleOutlinedIcon from '@mui/icons-material/BorderStyleOutlined';

function RightSidebar({ expanded, onToggle, userID, uName, profileImage }) {
    const { id } = useUserSession();
    const navigate = useNavigate();
    // If uName/profileImage are passed in props (persisted by App) we want to show them
    // even if the userID/session id is not available (page refresh). Also try localStorage fallback.
    const persistedName = uName || (typeof window !== 'undefined' && localStorage.getItem('uName')) || null;
    const persistedProfile = profileImage || (typeof window !== 'undefined' && localStorage.getItem('profileImage')) || null;
    const isLoggedIn = Boolean(userID || id || persistedName || persistedProfile);
    // Helper to get first letter of persistedName
    const getInitial = (name) => name ? name.charAt(0).toUpperCase() : '';
	
    return (
        <div
            className={`right-sidebar${expanded ? ' expanded' : ''}`}
            style={{
                width: expanded ? 120 : 60,
                transition: 'width 0.2s',
                background: 'rgb(225, 236, 244)',
                color: '#222',
                display: 'flex',
                flexDirection: 'column',
                alignItems: expanded ? 'flex-end' : 'center',
                paddingTop: 20,
                position: 'fixed',
                right: 0,
                top: 0,
                height: '100vh',
                zIndex: 2,
                justifyContent: 'flex-start',
                boxShadow: '-2px 0 6px rgba(0,0,0,0.05)'
            }}
        >
            {/* Avatar image always on top of expand button */}
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 10 }}>
                {isLoggedIn ? (
                    persistedProfile ? (
                        <img src={persistedProfile} alt="profile" className="img-fluid rounded-circle" style={{ width: 50, height: 50, objectFit: 'cover' }} />
                    ) : (
                        <Avatar style={{ width: 50, height: 50, fontSize: 24, background: '#90caf9', color: '#fff' }}>
                            {getInitial(persistedName)}
                        </Avatar>
                    )
                ) : (
                    <img src={avatar} alt="avatar" className="img-fluid rounded-circle" style={{ width: 50 }} />
                )}
                {expanded && isLoggedIn && persistedName && (
                    <div style={{ marginTop: 8, fontWeight: 'bold', fontSize: 14, color: '#333', textAlign: 'center', wordBreak: 'break-word' }}>
                        {persistedName}
                    </div>
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
                    alignSelf: expanded ? 'flex-start' : 'center',
                    transition: 'all 0.2s'
                }}
                aria-label="Toggle right menu"
            >
                {expanded ? <KeyboardDoubleArrowRightOutlinedIcon /> : '\u2630'}
            </button>
           
            {/* Dropdown menu (avatar + menu) */}
            {isLoggedIn ? (
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 20 }}>
                    {/* Logout menu item - icon and label in separate rows */}
                    <div
                        style={{ padding: expanded ? '10px 20px' : '10px 0', cursor: 'pointer', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
                        onClick={() => navigate('logout')}
                    >
                        <div>
                            <LogoutOutlinedIcon style={{ fontSize: expanded ? 24 : 20, color: '#333' }} />
                        </div>
                        {expanded && (
                            <div style={{ fontSize: 13, marginTop: 2 }}>Logout</div>
                        )}
                    </div>
                </div>
            ):
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div
                    style={{ padding: expanded ? '10px 20px' : '10px 0', cursor: 'pointer', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
                    onClick={() => navigate('login')}
                >
                    <div>
                        <LoginOutlinedIcon style={{ fontSize: expanded ? 24 : 20, color: '#333' }} />
                    </div>
                    {expanded && (
                        <div style={{ fontSize: 13, marginTop: 2 }}>Login</div>
                    )}
                </div>
            </div>
            }
			{/* Xttributes menu item - icon and label in separate rows */}
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 20 }}>
                <div
                    style={{ padding: expanded ? '10px 20px' : '10px 0', cursor: 'pointer', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}
                    onClick={() => navigate('xttributes')}
                >
                    <div>
                        <BorderStyleOutlinedIcon style={{ fontSize: expanded ? 24 : 20, color: '#333' }} />
                    </div>
                    {expanded && (
                        <div style={{ fontSize: 13, marginTop: 2 }}>My Xttributes</div>
                    )}
                </div>
            </div>
        </div>
    );
}

RightSidebar.propTypes = {
    expanded: PropTypes.bool.isRequired,
    onToggle: PropTypes.func.isRequired,
    userID: PropTypes.string,
    menu: PropTypes.any,
    showMenu: PropTypes.any,
    logMenu: PropTypes.any,
    xttributeMenu: PropTypes.any
};

export default RightSidebar;