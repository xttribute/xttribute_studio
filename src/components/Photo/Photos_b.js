import React from "react";
import { Resizable, ResizableBox } from "react-resizable";
import "./Photos.css";
import "../Keynote/Keynote";
class Photos extends React.Component{
	constructor(props) {
		super(props);
	 	this.state = { width: 200, height: 200 };
	}

  onClick = () => {
    this.setState({ width: 200, height: 200 });
  };

  onResize = (event, { element, size }) => {
    this.setState({ width: size.width, height: size.height });
  };

  render() {
    return (
      <div>
        <div className="layoutRoot">
		{this.props.records.map((record, j) => ( 
		  <ResizableBox className="resizebox" width={200} height={200}>
		             <span className="text">{"<ResizableBox>, same as above."}</span>
		    </ResizableBox>
		  ))} 
          
        </div>
      </div>
    );
  }
}
export default Photos;
