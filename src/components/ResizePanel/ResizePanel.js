import React from "react";
import { Resizable, ResizableBox } from "react-resizable";
import "./ResizePanel.css";
import "../Keynote/Keynote";
import Keynote from "../Keynote/Keynote";
class ResizePanel extends React.Component{
	constructor(props) {
		super(props);
	 	this.state = { width: 100, height: 800 };
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
          <Resizable
            className="resizebox"
            height={this.state.height}
            width={this.state.width}
            onResize={this.onResize}
          >
            <div
              className="resizebox polaroid"
              style={{
                width: this.state.width + "%",
                height: this.state.height + "px"
              }}
            >
             <Keynote
			 showError = {this.props.showError}
			 editable ={this.props.editable}
			 />
            </div>
          </Resizable>
          
          
        </div>
      </div>
    );
  }
}
export default ResizePanel;
