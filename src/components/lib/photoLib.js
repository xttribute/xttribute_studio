import React, { useEffect, useState } from 'react';
import Modal from '@mui/material/Modal';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import axios from 'axios';
import { API_BASE_URL, objDBName, gensDBName,CDNURL } from '../../constants/apiConstants';

export default function PhotoLib({ open, onClose, xid, productID, boxIndex = 0, onUpdated }) {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !xid) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const payload = {
          dbName: objDBName || gensDBName,
          collName: 'photo',
          docContents: "{'xid':'" + xid + "'}",
          operator: 'none',
          returnType: 'list',
          sortBy: '_id',
          order: 'DESC',
          limit: 200
        };
        const res = await axios.post(API_BASE_URL + `/getObjects?page=1`, payload);
        if (!cancelled && res && res.status === 200 && res.data) {
          const arr = Array.isArray(res.data) ? res.data : (res.data.objects || res.data.docs || []);
          setPhotos(arr || []);
        }
      } catch (e) {
        console.warn('[PhotoLib] failed to load photos', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [open, xid]);

  const handleSelect = async (photo) => {
    if (!photo || !photo._id) {
      onClose && onClose();
      return;
    }
    // Helper: ensure CDNURL is prefixed when appropriate
    const prefixCdn = (val) => {
      if (!val) return val;
      try {
        const s = String(val);
        // If it's already an absolute URL or already contains CDNURL, leave it
        if (s.startsWith('http') || s.startsWith('//') || (CDNURL && s.indexOf(CDNURL) === 0)) return s;
        if (!CDNURL) return s;
        const base = CDNURL.endsWith('/') ? CDNURL : CDNURL + '/';
        return s.startsWith('/') ? base + s.slice(1) : base + s;
      } catch (e) { return val; }
    };

    // Prepare a photo value to store (prefer path/url fields if present)
    const rawVal = photo.photo || photo.url || photo.path || String(photo._id);
    // Prefixed value for preview (with CDN)
    const photoValue = prefixCdn(rawVal);

    // Update the photo record 'photo' field to reference this product and image slot.
    // Instead of updating the photo document, update the product document.
    // We'll set the product's image slot (e.g. image1, image2...) to the raw value (no CDN)
    // so the canonical stored path remains CDN-agnostic.
    const imageKey = 'image' + (Number(boxIndex || 0) + 1);
    // Do not call backend from the photo library. Always notify parent with selection
    // and let the parent decide whether to update product records.
    onUpdated && onUpdated({ boxIndex, photo, photoValue, rawVal });

    onClose && onClose();
  };

  return (
    <Modal open={Boolean(open)} onClose={onClose} aria-labelledby="photo-lib-modal">
      <Box sx={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '80vw',
        maxWidth: 900,
        bgcolor: 'background.paper',
        boxShadow: 24,
        p: 2,
        maxHeight: '80vh',
        overflow: 'auto'
      }}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8}}>
          <div style={{fontWeight: 600}}>Select Photo</div>
          <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
        </div>

        {loading ? <div>Loading...</div> : null}

        <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8}}>
          {photos && photos.length ? photos.map(p => {
            // Attempt to determine thumbnail URL and prefix CDN if needed
            const rawThumb = p.thumbnail || p.thumb || p.url || p.path || p.photo || '';
            const thumb = (function(r) {
              if (!r) return '';
              try {
                if (r.startsWith('http') || r.startsWith('//') || (CDNURL && r.indexOf(CDNURL) === 0)) return r;
                if (!CDNURL) return r;
                const base = CDNURL.endsWith('/') ? CDNURL : CDNURL + '/';
                return r.startsWith('/') ? base + r.slice(1) : base + r;
              } catch (e) { return r; }
            })(rawThumb);
            return (
              <div key={String(p._id)} onClick={() => handleSelect(p)} style={{cursor: 'pointer', border: '1px solid #eee', borderRadius: 6, overflow: 'hidden', background: '#fff', height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                {thumb ? (
                  <img src={thumb} alt={p.title || ''} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
                ) : (
                  <div style={{color: '#999'}}>{p.title || String(p._id)}</div>
                )}
              </div>
            );
          }) : (
            <div style={{color: '#666'}}>No photos found for this xttribute.</div>
          )}
        </div>
      </Box>
    </Modal>
  );
}