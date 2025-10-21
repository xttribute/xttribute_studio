import React, {useState} from 'react';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Box from '@mui/material/Box';
import ResizePanel from '../ResizePanel/ResizePanel';
import SummarizeOutlinedIcon from '@mui/icons-material/SummarizeOutlined';
import PropTypes from 'prop-types';
import './AppMenu.css';
import Keynote from "../Keynote/Keynote";
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
		 <Tab  icon={<SummarizeOutlinedIcon  fontSize="medium"/>} label="Keynotes" {...a11yProps(0)}/>
		
		</Tabs>
		</Box>
		<CustomTabPanel value={value} index={0}>
          <Keynote />
        </CustomTabPanel>
		</Box>
	);
}

export default AppMenu;