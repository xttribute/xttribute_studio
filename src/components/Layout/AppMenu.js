import React, {useState} from 'react';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Box from '@mui/material/Box';
import ResizePanel from '../ResizePanel/ResizePanel';
import SummarizeOutlinedIcon from '@mui/icons-material/SummarizeOutlined';
import PhotoLibraryOutlinedIcon from '@mui/icons-material/PhotoLibraryOutlined';
import PropTypes from 'prop-types';
import './AppMenu.css';
import Keynote from "../Keynote/Keynote";
import Photo from "../Photo/Photo";
function CustomTabPanel(props) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

CustomTabPanel.propTypes = {
  children: PropTypes.node,
  index: PropTypes.number.isRequired,
  value: PropTypes.number.isRequired,
};

function a11yProps(index) {
  return {
    id: `simple-tab-${index}`,
    'aria-controls': `simple-tabpanel-${index}`,
  };
}

function AppMenu(props){
	const [value, setValue] = React.useState(0);

	 const handleChange = (event, newValue) => {
	   setValue(newValue);
	 };

	return(
		<Box sx={{ width: '100%' }} >
		<Box class ="menuBar">
		<Tabs
		      value={value}
		      onChange={handleChange}
		      variant="scrollable"
		      scrollButtons
		      allowScrollButtonsMobile
		      aria-label="scrollable force tabs example"
		    >
		<Tab  icon={<PhotoLibraryOutlinedIcon  fontSize="medium"/>} label="Photos" {...a11yProps(0)}/>
		 <Tab  icon={<SummarizeOutlinedIcon  fontSize="medium"/>} label="Keynotes" {...a11yProps(1)}/>
		
		</Tabs>
		</Box>
		<CustomTabPanel value={value} index={0}>
		<Photo
				showError = {props.showError}
				editable ={props.editable}
		/>
		     </CustomTabPanel>
			 <CustomTabPanel value={value} index={1}>
			 <Keynote
			 		 showError = {props.showError}
			 		 editable ={props.editable}
			 		 />
			 </CustomTabPanel>
		</Box>
	);
}

export default AppMenu;