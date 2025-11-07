import React, { useState, useEffect, useRef } from "react";
import "./Editable.css";
import useXttribute from '../Xttribute/useXttribute';
import { CiEdit } from "react-icons/ci";
import {Row, Col, Container} from 'reactstrap';

const Editable = ({
  text,
  type,
  placeholder,
  children,
  childRef,
  onSave,
  edit,
  name,
  keyId,
  boldText,
  editControllerRef,
  hideIcon,
  onEditStateChange,
  ...props
}) => {
  const [isEditing, setEditing] = useState(false);
  const internalRef = useRef(null);
  const skipBlurRef = useRef(false);

  // expose controller API to parent
  useEffect(() => {
    if (!editControllerRef) return;
    try {
      editControllerRef.current = {
        start: () => setEditing(true),
        stop: () => setEditing(false),
        isEditing: () => isEditing,
        save: () => handleSave(true), // programmatic save
        preventBlurOnce: () => { skipBlurRef.current = true; }
      };
    } catch (e) { /* ignore */ }
    return () => { if (editControllerRef) editControllerRef.current = null; };
  }, [editControllerRef, isEditing]);

  // notify parent when edit state changes
  useEffect(() => {
    if (typeof onEditStateChange === 'function') {
      try { onEditStateChange(isEditing); } catch (e) { /* ignore */ }
    }
  }, [isEditing, onEditStateChange]);

  // focus on edit start
  useEffect(() => {
    const refToFocus = (childRef && childRef.current) ? childRef.current : internalRef.current;
    if (refToFocus && isEditing === true) {
      try { refToFocus.focus(); } catch (e) { /* ignore */ }
    }
  }, [isEditing, childRef]);

  const handleKeyDown = (event, type) => {
    const { key } = event;
    const keys = ["Escape", "Tab"];
    const enterKey = "Enter";
    const allKeys = [...keys, enterKey];
    if (
      (type === "textarea" && keys.indexOf(key) > -1) ||
      (type !== "textarea" && allKeys.indexOf(key) > -1)
    ) {
      handleSave();
    }
  };
 
  // perform save; if programmatic=true then caller expects a return (promise)
  const handleSave = async (programmatic = false) => {
    const refToRead = (childRef && childRef.current) ? childRef.current : internalRef.current;
    let newValue = text;
    try {
      if (refToRead) {
        if (typeof refToRead.value !== 'undefined') newValue = refToRead.value;
        else if (typeof refToRead.innerText !== 'undefined') newValue = refToRead.innerText;
      }
    } catch (e) { /* ignore */ }

    let result;
    try {
      if (onSave) {
        result = onSave(newValue, keyId);
        if (result && typeof result.then === 'function') {
          await result;
        }
      }
      return result;
    } finally {
      // only exit edit mode after save attempt
      setEditing(false);
    }
  };

  if (edit === "t") {
    return (
      <section {...props}>
        {isEditing ? (
          <div
            onBlur={async () => {
              if (skipBlurRef.current) { skipBlurRef.current = false; return; }
              await handleSave();
            }}
            onKeyDown={e => handleKeyDown(e, type)}
          >
            {React.Children.map(children, (child) => {
              if (React.isValidElement(child)) {
                const refToAttach = childRef || internalRef;
                const propsToAdd = { ref: refToAttach, autoFocus: true };
                try {
                  const tag = (typeof child.type === 'string') ? child.type : (child.props && child.props.as);
                  if (tag === 'input' || tag === 'textarea' || child.props?.type === 'text') {
                    propsToAdd.defaultValue = text;
                    propsToAdd.className = (child.props && child.props.className ? child.props.className + ' ' : '') + 'editable-input';
                  } else {
                    propsToAdd.children = text;
                  }
                } catch (e) { /* ignore */ }
                return React.cloneElement(child, propsToAdd);
              }
              return child;
            })}
          </div>
        ) : (
          <Row>
            <Col>
              <div
                className={`rounded py-2 px-3 text-gray-700 leading-tight whitespace-pre-wrap hover:shadow-outline editable-${type}`}
                onMouseDown={(e) => { e.preventDefault(); setEditing(true); }}
              >
                <span className={`${boldText ? "textBold" : "text-gray-500"}`}>
                  {text || placeholder || "Editable content"}
                </span>
              </div>
            </Col>
            {!hideIcon && (
              <Col xs={2}>
                <h5 className="edit-icon"><CiEdit /></h5>
              </Col>
            )}
          </Row>
        )}
      </section>
    );
  } else {
    return (
      <section {...props}>
        {isEditing ? (
          <div
            onBlur={async () => { if (skipBlurRef.current) { skipBlurRef.current = false; return; } await handleSave(); }}
            onKeyDown={e => handleKeyDown(e, type)}
          >
            {React.Children.map(children, (child) => {
              if (React.isValidElement(child)) {
                const refToAttach = childRef || internalRef;
                const propsToAdd = { ref: refToAttach, autoFocus: true };
                try {
                  const tag = (typeof child.type === 'string') ? child.type : (child.props && child.props.as);
                  if (tag === 'input' || tag === 'textarea' || child.props?.type === 'text') {
                    propsToAdd.defaultValue = text;
                    propsToAdd.className = (child.props && child.props.className ? child.props.className + ' ' : '') + 'editable-input';
                  } else {
                    propsToAdd.children = text;
                  }
                } catch (e) { /* ignore */ }
                return React.cloneElement(child, propsToAdd);
              }
              return child;
            })}
          </div>
        ) : (
          <div
            className={`rounded py-2 px-3 text-gray-700 leading-tight whitespace-pre-wrap hover:shadow-outline editable-${type}`}
            onMouseDown={(e) => { e.preventDefault(); setEditing(true); }}
          >
            <span className={`${boldText ? "textBold" : "text-gray-500"}`}>
              {text || placeholder || "Editable content"}
            </span>
          </div>
        )}
      </section>
    );
  }

};

export default Editable;