//IMPORTS
require("dotenv").config();

const cookieParser = require("cookie-parser");
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const credentials = require("./middleware/credentials");
const corsOptions = require("./middleware/corsOption");
const errorMiddleware = require("./middleware/errorMiddleware");



//create express app and get port for connection
const app = express(); //create express app

//middleware setup
app.use(credentials); 				//handle options credentials check - before CORS!
app.use(cors(corsOptions));			//cross origin resource sharing setup 

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: false, limit: '50mb' }));
app.use(cookieParser());
app.use(morgan(process.env.LOG_LEVEL));

BigInt.prototype.toJSON = function () {
  return this.toString();
};

//base route for the app
app.use("/v1/api/hr", require("./routes/routes"));

// Background jobs
require('./helpers/cronHelper');

//catch all errors
app.use(errorMiddleware);










module.exports = app;