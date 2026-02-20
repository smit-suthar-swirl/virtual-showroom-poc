import express from "express";

const app = express();
app.use(express.static("public"));
app.listen(3005, () =>
  console.log("\n  BYD 3D Viewer — http://localhost:3005\n"),
);
