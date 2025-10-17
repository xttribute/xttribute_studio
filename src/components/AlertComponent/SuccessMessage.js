import React, { useState, useEffect } from 'react';
import './SuccessMessage.css';
function SuccessMessage(props){
	const [showSuccessMessage, setShowSuccessMessage] = useState(false);
	useEffect(() => {
		    let timeoutId;
		    if (showSuccessMessage) {
		      timeoutId = setTimeout(() => {
		        setShowSuccessMessage(false);
		      }, 2000);
		    }

		    // Clear timeout on unmount or if showSuccessMessage changes to false
		    return () => clearTimeout(timeoutId);
		  }, [showSuccessMessage]);
	useEffect(()=>{
	    if (props.successMessage !==null){
			setShowSuccessMessage(true);
		}	 
	}, [props.successMessage]);
	return(
	<div>
		{showSuccessMessage &&     
			<div className="alert alert-success mt-2" style= {{display: 'block'}}  role="alert">
				{props.successMessage}
			</div>  
		}
	</div>     
	)
}
export default SuccessMessage