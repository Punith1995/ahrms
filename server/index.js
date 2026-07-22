const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static("uploads"));

app.get("/", (req, res) => res.send("AHRMS API running"));

app.listen(process.env.PORT, () =>
  console.log(`Server on http://localhost:${process.env.PORT}`)
);