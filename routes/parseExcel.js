/**
 * Created by srujan on 20/01/15.
 */

var express = require('express');
var router = express.Router();
var fs = require('fs');

var xlReader = require('node-xlsx');
var excelbuilder = require('msexcel-builder');
var multer  = require('multer');

router.get("/",function(req, res){
    var path = './temp/myFile.xlsx';
    var obj = xlReader.parse(path); // parses a file
    res.status(200).json(obj);
});

router.get("/create", function(req, res){

    var workbook = excelbuilder.createWorkbook('./', 'sample.xlsx')

    // Create a new worksheet with 10 columns and 12 rows
    var sheet1 = workbook.createSheet('sheet1', 10, 12);

    // Fill some data
    sheet1.set(1, 1, 'I am title');
    for (var i = 2; i < 5; i++)
        sheet1.set(i, 1, 'test'+i);

    // Save it
    workbook.save(function(err){
        if (err) {
            workbook.cancel();
            res.status(500).json(err);
        }
        else {
            res.status(200).json("success");
        }
    });

});

module.exports = router;