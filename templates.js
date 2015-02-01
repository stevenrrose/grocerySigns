var templates = {
    "template1" : {
        /* Letter */
        width: 612,
        height: 792,
        font: Raiders,
        maxRatio: 2,
        padX: 10, padY: 0,
        fields : {
            "FIELD01" : {x: 0,   y: 77,  width: 612, height: 230  },
            "FIELD02" : {x: 0,   y: 0,   width: 612, height: 77,  inverted: true},
            "FIELD03" : {x: 0,   y: 384, width: 612, height: 154, type: 'price', currency: "$", separator: ".", mainWidth: 306, mainHeight: 408, mainShift: -55},
            "FIELD04" : {x: 0,   y: 307, width: 612, height: 77   },
            "FIELD05" : {x: 306, y: 538, width: 306, height: 96   },
            "FIELD06" : {x: 306, y: 634, width: 306, height: 96   }
        }
    }
};
