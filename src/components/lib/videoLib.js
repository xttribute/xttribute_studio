import React, { useEffect, useState } from 'react';
import Modal from '@mui/material/Modal';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import axios from 'axios';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import { API_BASE_URL, objDBName, gensDBName, CDNURL } from '../../constants/apiConstants';

// Simple video library modal that lists videos for the current xttribute (xid)
// Props:
// - open: boolean
// - onClose: () => void
// - xid: optional filter
// - onSelect: (video) => void
export default function VideoLib({ open, onClose, xid, onSelect }) {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const fetchVideos = async () => {
      setLoading(true);
      try {
        const docContents = xid ? "{'xid':'" + xid + "'}" : "{}";
        const payload = {
          dbName: objDBName,
          collName: 'video',
          docContents: docContents,
          operator: 'none',
          returnType: 'list',
          sortBy: '_id',
          order: 'DESC',
          limit: 200
        };
        const res = await axios.post(API_BASE_URL + '/getObjects?page=1', payload);
        if (cancelled) return;
        if (res && res.status === 200 && res.data) {
          const arr = Array.isArray(res.data) ? res.data : (res.data.objects || res.data.docs || []);
          setVideos(arr || []);
        }
      } catch (e) {
        console.warn('[VideoLib] fetch error', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchVideos();
    return () => { cancelled = true; };
  }, [open, xid]);

  return (
    <Modal open={!!open} onClose={onClose} aria-labelledby="video-lib-modal">
      <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', bgcolor: 'background.paper', boxShadow: 24, p: 2, width: '80vw', maxWidth: 900, maxHeight: '80vh', overflow: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ fontWeight: 600 }}>Video library</div>
          <IconButton size="small" onClick={onClose} aria-label="close-video-lib"><CloseIcon fontSize="small" /></IconButton>
        </div>
        <div style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>Select a video to add to the product playlist</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
          {loading ? (
            <div>Loading...</div>
          ) : (videos.length === 0 ? <div style={{ color: '#999' }}>No videos found</div> : videos.map((v, i) => {
            const thumb = v && v.videoThumbnail ? String(v.videoThumbnail) : null;
            const thumbUrl = thumb ? (CDNURL + thumb) : null;
            const title = (v && (v.title || v.name)) ? String(v.title || v.name) : 'Untitled';
            return (
              <div key={i} style={{ border: '1px solid #eee', borderRadius: 6, overflow: 'hidden', background: '#fff' }}>
                <div style={{ width: '100%', height: 100, background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {thumbUrl ? <img src={thumbUrl} alt={title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ color: '#999' }}>No thumbnail</div>}
                </div>
                <div style={{ padding: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }} title={title}>{title.length > 40 ? (title.substring(0, 40) + '...') : title}</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <Button size="small" onClick={() => { if (onSelect) onSelect(v); }} startIcon={<AddIcon />}>Add</Button>
                  </div>
                </div>
              </div>
            );
          }))}
        </div>
      </Box>
    </Modal>
  );
}