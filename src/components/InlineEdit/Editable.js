import React, { useState, useEffect } from "react";
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
  //console.log(edit);
  useEffect(() => {
    if (childRef && childRef.current && isEditing === true) {
      childRef.current.focus();
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
      onSave(text, keyId);
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
		          {children}
		        </div>
		      ) : (
		        <Row>
				<Col>
				<div
		          className={`rounded py-2 px-3 text-gray-700 leading-tight whitespace-pre-wrap hover:shadow-outline editable-${type}`}
				  onClick={() => setEditing(true)}
		        >
		          <span className={`${boldText ? "textBold" : "text-gray-500"}`}>
		            {text || placeholder || "Editable content"}
		          </span>
				  </div>
				  </Col>
				  <Col xs={2}>
				  <h5><CiEdit /></h5>
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
		          {children}
		        </div>
		      ) : (
		        <div
		          className={`rounded py-2 px-3 text-gray-700 leading-tight whitespace-pre-wrap hover:shadow-outline editable-${type}`}
				  onClick={() => setEditing(false)}
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