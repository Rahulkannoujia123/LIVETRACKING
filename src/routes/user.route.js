const express = require('express');
const router = express.Router();
const driverController = require('../controller/livetrackingdriver.controller');

router.post('/add-driver-location',driverController.addDriverLocation);
router.post('/update-location', driverController.updateDriverLocation);
router.get('/location', driverController.updateDriverLocation);

module.exports = router;
