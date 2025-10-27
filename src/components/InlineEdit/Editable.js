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
  ...props
}) => {
  const [isEditing, setEditing] = useState(false);
  const internalRef = useRef(null);
  //console.log(edit);
  useEffect(() => {
    // focus either provided childRef or internalRef when entering edit mode
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
 
  const handleSave = () => {
      // Read current value from childRef or internalRef so we save the live input content
      const refToRead = (childRef && childRef.current) ? childRef.current : internalRef.current;
      let newValue = text;
      try {
        if (refToRead) {
          if (typeof refToRead.value !== 'undefined') newValue = refToRead.value;
          else if (typeof refToRead.innerText !== 'undefined') newValue = refToRead.innerText;
        }
      } catch (e) {
        // ignore
      }
      if (onSave) onSave(newValue, keyId);
      setEditing(false);
    };
	if(edit==="t"){
		return (
		    <section {...props}>
		      {isEditing ? (
		        <div
		          onBlur={() => handleSave()}
		          onKeyDown={e => handleKeyDown(e, type)}
		        >
		          {React.Children.map(children, (child) => {
		            // attach provided childRef (from parent) or internalRef and autoFocus to the first valid child element so it receives focus immediately
		            if (React.isValidElement(child)) {
		              const refToAttach = childRef || internalRef;
		              return React.cloneElement(child, { ref: refToAttach, autoFocus: true });
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
				  <Col xs={2}>
                    <h5 className="edit-icon"><CiEdit /></h5>
                 	</Col>
				</Row>	
		      )}
		    </section>
		  );
		
	}else{
		return (
		    <section {...props}>
		      {isEditing ? (
		        <div
		          onBlur={() => handleSave()}
		          onKeyDown={e => handleKeyDown(e, type)}
		        >
		          {React.Children.map(children, (child) => {
		            if (React.isValidElement(child)) {
		              const refToAttach = childRef || internalRef;
		              return React.cloneElement(child, { ref: refToAttach, autoFocus: true });
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