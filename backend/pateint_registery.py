"""
ABDM-COMPLIANT MOCK REGISTRY
Updated to match the exact JSON schema returned by the National Health Authority Sandbox.
The primary test user (Ramesh Kumar) is pinned to mobile: 9088260058.
"""

MOCK_ABHA_REGISTRY = {
    # --- HIGHLIGHTED TEST PROFILE (PINNED NUMBER) ---
    "ramesh.kumar@abdm": {
        "healthIdNumber": "91-1001-2001-3001",
        "healthId": "ramesh.kumar@abdm",
        "name": "Ramesh Kumar",
        "gender": "M",
        "yearOfBirth": "1988",
        "monthOfBirth": "06",
        "dayOfBirth": "12",
        "address": "Salt Lake Sector V",
        "districtName": "Kolkata",
        "stateName": "West Bengal",
        "pincode": "700091",
        "mobile": "9088260058",  # <--- PINNED TEST NUMBER
        "profilePhoto": ""
    },
    
    # --- WEST BENGAL ---
    "ananya.sen@abdm": {
        "healthIdNumber": "91-1001-2001-3002",
        "healthId": "ananya.sen@abdm",
        "name": "Ananya Sen",
        "gender": "F",
        "yearOfBirth": "1995",
        "monthOfBirth": "11",
        "dayOfBirth": "23",
        "address": "Jadavpur",
        "districtName": "Kolkata",
        "stateName": "West Bengal",
        "pincode": "700032",
        "mobile": "8420744956",  # <--- INJECTED NUMBER 2
        "profilePhoto": ""
    },
    "subhash.bose@abdm": {
        "healthIdNumber": "91-1001-2001-3003",
        "healthId": "subhash.bose@abdm",
        "name": "Subhashish Bose",
        "gender": "M",
        "yearOfBirth": "1962",
        "monthOfBirth": "01",
        "dayOfBirth": "15",
        "address": "Ballygunge",
        "districtName": "Kolkata",
        "stateName": "West Bengal",
        "pincode": "700019",
        "mobile": "9830334455",
        "profilePhoto": ""
    },
    "mita.chatterjee@abdm": {
        "healthIdNumber": "91-1001-2001-3004",
        "healthId": "mita.chatterjee@abdm",
        "name": "Mita Chatterjee",
        "gender": "F",
        "yearOfBirth": "1974",
        "monthOfBirth": "08",
        "dayOfBirth": "19",
        "address": "Howrah City",
        "districtName": "Howrah",
        "stateName": "West Bengal",
        "pincode": "711101",
        "mobile": "7044643350",  # <--- INJECTED NUMBER 3
        "profilePhoto": ""
    },
    "debojit.das@abdm": {
        "healthIdNumber": "91-1001-2001-3005",
        "healthId": "debojit.das@abdm",
        "name": "Debojit Das",
        "gender": "M",
        "yearOfBirth": "2003",
        "monthOfBirth": "04",
        "dayOfBirth": "10",
        "address": "Pradhan Nagar",
        "districtName": "Siliguri",
        "stateName": "West Bengal",
        "pincode": "734003",
        "mobile": "9830556677",
        "profilePhoto": ""
    },
    "mita.chatterjee@abdm": {
        "abha_number": "91-1001-2001-3004",
        "name": "Mita Chatterjee",
        "gender": "F",
        "dob": "1974-08-19",
        "address": "Howrah, West Bengal",
        "mobile": "9830445566",
        "blood_group": "AB+"
    },
    "debojit.das@abdm": {
        "abha_number": "91-1001-2001-3005",
        "name": "Debojit Das",
        "gender": "M",
        "dob": "2003-04-10",
        "address": "Siliguri, West Bengal",
        "mobile": "9830556677",
        "blood_group": "O-"
    },
    "tanusree.paul@abdm": {
        "abha_number": "91-1001-2001-3006",
        "name": "Tanusree Paul",
        "gender": "F",
        "dob": "1982-12-05",
        "address": "Durgapur, West Bengal",
        "mobile": "9830667788",
        "blood_group": "A-"
    },
    "sourav.ganguly@abdm": {
        "abha_number": "91-1001-2001-3007",
        "name": "Sourav Mondal",
        "gender": "M",
        "dob": "1991-07-08",
        "address": "Behala, Kolkata, West Bengal",
        "mobile": "9830778899",
        "blood_group": "B-"
    },
    "ruma.ghosh@abdm": {
        "abha_number": "91-1001-2001-3008",
        "name": "Ruma Ghosh",
        "gender": "F",
        "dob": "1958-03-30",
        "address": "Asansol, West Bengal",
        "mobile": "9830889900",
        "blood_group": "O+"
    },
    "arindam.roy@abdm": {
        "abha_number": "91-1001-2001-3009",
        "name": "Arindam Roy",
        "gender": "M",
        "dob": "1986-09-14",
        "address": "New Town, Kolkata, West Bengal",
        "mobile": "9830990011",
        "blood_group": "A+"
    },
    "swati.banerjee@abdm": {
        "abha_number": "91-1001-2001-3010",
        "name": "Swati Banerjee",
        "gender": "F",
        "dob": "2001-02-18",
        "address": "Burdwan, West Bengal",
        "mobile": "9831001122",
        "blood_group": "B+"
    },

    # --- BIHAR ---
    "sunita.devi@abdm": {
        "abha_number": "91-1002-2002-3011",
        "name": "Sunita Devi",
        "gender": "F",
        "dob": "1955-03-24",
        "address": "Kankarbagh, Patna, Bihar",
        "mobile": "9431012345",
        "blood_group": "B+"
    },
    "amit.kumar.jha@abdm": {
        "abha_number": "91-1002-2002-3012",
        "name": "Amit Kumar Jha",
        "gender": "M",
        "dob": "1983-05-11",
        "address": "Darbhanga, Bihar",
        "mobile": "9431123456",
        "blood_group": "O+"
    },
    "priya.kumari@abdm": {
        "abha_number": "91-1002-2002-3013",
        "name": "Priya Kumari",
        "gender": "F",
        "dob": "1999-10-02",
        "address": "Muzaffarpur, Bihar",
        "mobile": "9431234567",
        "blood_group": "A+"
    },
    "satish.prasad@abdm": {
        "abha_number": "91-1002-2002-3014",
        "name": "Satish Prasad",
        "gender": "M",
        "dob": "1967-12-28",
        "address": "Gaya, Bihar",
        "mobile": "9431345678",
        "blood_group": "AB+"
    },
    "vandana.singh@abdm": {
        "abha_number": "91-1002-2002-3015",
        "name": "Vandana Singh",
        "gender": "F",
        "dob": "1989-08-07",
        "address": "Bhagalpur, Bihar",
        "mobile": "9431456789",
        "blood_group": "B-"
    },
    "manoj.tiwary@abdm": {
        "abha_number": "91-1002-2002-3016",
        "name": "Manoj Tiwary",
        "gender": "M",
        "dob": "1978-04-16",
        "address": "Ara, Bhojpur, Bihar",
        "mobile": "9431567890",
        "blood_group": "O+"
    },
    "reena.yadav@abdm": {
        "abha_number": "91-1002-2002-3017",
        "name": "Reena Yadav",
        "gender": "F",
        "dob": "1993-01-22",
        "address": "Purnia, Bihar",
        "mobile": "9431678901",
        "blood_group": "A-"
    },
    "deepak.choudhary@abdm": {
        "abha_number": "91-1002-2002-3018",
        "name": "Deepak Choudhary",
        "gender": "M",
        "dob": "2000-06-19",
        "address": "Begusarai, Bihar",
        "mobile": "9431789012",
        "blood_group": "B+"
    },
    "shanti.devi@abdm": {
        "abha_number": "91-1002-2002-3019",
        "name": "Shanti Devi",
        "gender": "F",
        "dob": "1950-11-12",
        "address": "Chapra, Saran, Bihar",
        "mobile": "9431890123",
        "blood_group": "O+"
    },
    "pankaj.mishra@abdm": {
        "abha_number": "91-1002-2002-3020",
        "name": "Pankaj Mishra",
        "gender": "M",
        "dob": "1985-09-03",
        "address": "Motihari, Bihar",
        "mobile": "9431901234",
        "blood_group": "A+"
    },

    # --- MAHARASHTRA ---
    "aarav.sharma@abdm": {
        "abha_number": "91-1003-2003-3021",
        "name": "Aarav Sharma",
        "gender": "M",
        "dob": "2018-11-05",
        "address": "Andheri West, Mumbai, Maharashtra",
        "mobile": "9820011223",
        "blood_group": "A-"
    },
    "pradeep.kulkarni@abdm": {
        "abha_number": "91-1003-2003-3022",
        "name": "Pradeep Kulkarni",
        "gender": "M",
        "dob": "1960-07-14",
        "address": "Kothrud, Pune, Maharashtra",
        "mobile": "9820122334",
        "blood_group": "B+"
    },
    "sneha.deshmukh@abdm": {
        "abha_number": "91-1003-2003-3023",
        "name": "Sneha Deshmukh",
        "gender": "F",
        "dob": "1992-03-27",
        "address": "Thane West, Maharashtra",
        "mobile": "9820233445",
        "blood_group": "O+"
    },
    "vikram.patil@abdm": {
        "abha_number": "91-1003-2003-3024",
        "name": "Vikram Patil",
        "gender": "M",
        "dob": "1981-12-10",
        "address": "Kolhapur, Maharashtra",
        "mobile": "9820344556",
        "blood_group": "AB+"
    },
    "pooja.shinde@abdm": {
        "abha_number": "91-1003-2003-3025",
        "name": "Pooja Shinde",
        "gender": "F",
        "dob": "1997-05-18",
        "address": "Nashik, Maharashtra",
        "mobile": "9820455667",
        "blood_group": "A+"
    },
    "sanjay.more@abdm": {
        "abha_number": "91-1003-2003-3026",
        "name": "Sanjay More",
        "gender": "M",
        "dob": "1972-09-25",
        "address": "Nagpur, Maharashtra",
        "mobile": "9820566778",
        "blood_group": "O-"
    },
    "anjali.gaikwad@abdm": {
        "abha_number": "91-1003-2003-3027",
        "name": "Anjali Gaikwad",
        "gender": "F",
        "dob": "1987-02-08",
        "address": "Aurangabad, Maharashtra",
        "mobile": "9820677889",
        "blood_group": "B+"
    },
    "rohit.jadhav@abdm": {
        "abha_number": "91-1003-2003-3028",
        "name": "Rohit Jadhav",
        "gender": "M",
        "dob": "1994-10-15",
        "address": "Solapur, Maharashtra",
        "mobile": "9820788990",
        "blood_group": "A+"
    },
    "meenakshi.joshi@abdm": {
        "abha_number": "91-1003-2003-3029",
        "name": "Meenakshi Joshi",
        "gender": "F",
        "dob": "1965-06-20",
        "address": "Dadar, Mumbai, Maharashtra",
        "mobile": "9820899001",
        "blood_group": "B-"
    },
    "amol.bhosale@abdm": {
        "abha_number": "91-1003-2003-3030",
        "name": "Amol Bhosale",
        "gender": "M",
        "dob": "1989-11-30",
        "address": "Navi Mumbai, Maharashtra",
        "mobile": "9820900112",
        "blood_group": "O+"
    },

    # --- DELHI NCR ---
    "harpreet.singh@abdm": {
        "abha_number": "91-1004-2004-3031",
        "name": "Harpreet Singh",
        "gender": "M",
        "dob": "1980-08-15",
        "address": "Tilak Nagar, New Delhi",
        "mobile": "9811011223",
        "blood_group": "B+"
    },
    "divya.kapoor@abdm": {
        "abha_number": "91-1004-2004-3032",
        "name": "Divya Kapoor",
        "gender": "F",
        "dob": "1991-04-09",
        "address": "Rohini Sector 9, New Delhi",
        "mobile": "9811122334",
        "blood_group": "A+"
    },
    "manish.gupta@abdm": {
        "abha_number": "91-1004-2004-3033",
        "name": "Manish Gupta",
        "gender": "M",
        "dob": "1976-12-01",
        "address": "Laxmi Nagar, New Delhi",
        "mobile": "9811233445",
        "blood_group": "O+"
    },
    "neha.aggarwal@abdm": {
        "abha_number": "91-1004-2004-3034",
        "name": "Neha Aggarwal",
        "gender": "F",
        "dob": "1998-07-23",
        "address": "Dwarka Sector 6, New Delhi",
        "mobile": "9811344556",
        "blood_group": "AB+"
    },
    "rajender.kumar@abdm": {
        "abha_number": "91-1004-2004-3035",
        "name": "Rajender Kumar",
        "gender": "M",
        "dob": "1959-02-14",
        "address": "Karol Bagh, New Delhi",
        "mobile": "9811455667",
        "blood_group": "B-"
    },
    "simran.kaur@abdm": {
        "abha_number": "91-1004-2004-3036",
        "name": "Simran Kaur",
        "gender": "F",
        "dob": "2002-09-17",
        "address": "Janakpuri, New Delhi",
        "mobile": "9811566778",
        "blood_group": "O+"
    },
    "ashish.verma@abdm": {
        "abha_number": "91-1004-2004-3037",
        "name": "Ashish Verma",
        "gender": "M",
        "dob": "1987-03-29",
        "address": "Saket, New Delhi",
        "mobile": "9811677889",
        "blood_group": "A-"
    },
    "kamla.devi@abdm": {
        "abha_number": "91-1004-2004-3038",
        "name": "Kamla Devi",
        "gender": "F",
        "dob": "1953-10-11",
        "address": "Mayur Vihar Phase 1, New Delhi",
        "mobile": "9811788990",
        "blood_group": "B+"
    },
    "gaurav.malhotra@abdm": {
        "abha_number": "91-1004-2004-3039",
        "name": "Gaurav Malhotra",
        "gender": "M",
        "dob": "1993-06-04",
        "address": "Vasant Kunj, New Delhi",
        "mobile": "9811899001",
        "blood_group": "O+"
    },
    "shweta.sharma@abdm": {
        "abha_number": "91-1004-2004-3040",
        "name": "Shweta Sharma",
        "gender": "F",
        "dob": "1985-01-26",
        "address": "Pitampura, New Delhi",
        "mobile": "9811900112",
        "blood_group": "A+"
    },

    # --- UTTAR PRADESH ---
    "rameshwar.pandey@abdm": {
        "abha_number": "91-1005-2005-3041",
        "name": "Rameshwar Pandey",
        "gender": "M",
        "dob": "1963-05-19",
        "address": "Gomti Nagar, Lucknow, Uttar Pradesh",
        "mobile": "9415012345",
        "blood_group": "O+"
    },
    "rekha.shukla@abdm": {
        "abha_number": "91-1005-2005-3042",
        "name": "Rekha Shukla",
        "gender": "F",
        "dob": "1977-11-03",
        "address": "Civil Lines, Kanpur, Uttar Pradesh",
        "mobile": "9415123456",
        "blood_group": "B+"
    },
    "alok.yadav@abdm": {
        "abha_number": "91-1005-2005-3043",
        "name": "Alok Yadav",
        "gender": "M",
        "dob": "1990-08-14",
        "address": "Varanasi, Uttar Pradesh",
        "mobile": "9415234567",
        "blood_group": "A+"
    },
    "geeta.srivastava@abdm": {
        "abha_number": "91-1005-2005-3044",
        "name": "Geeta Srivastava",
        "gender": "F",
        "dob": "1984-02-28",
        "address": "Prayagraj, Uttar Pradesh",
        "mobile": "9415345678",
        "blood_group": "AB+"
    },
    "virendra.singh@abdm": {
        "abha_number": "91-1005-2005-3045",
        "name": "Virendra Singh",
        "gender": "M",
        "dob": "1971-06-22",
        "address": "Agra, Uttar Pradesh",
        "mobile": "9415456789",
        "blood_group": "O-"
    },
    "archana.mishra@abdm": {
        "abha_number": "91-1005-2005-3046",
        "name": "Archana Mishra",
        "gender": "F",
        "dob": "1996-12-09",
        "address": "Gorakhpur, Uttar Pradesh",
        "mobile": "9415567890",
        "blood_group": "B+"
    },
    "suresh.chandra@abdm": {
        "abha_number": "91-1005-2005-3047",
        "name": "Suresh Chandra",
        "gender": "M",
        "dob": "1956-04-17",
        "address": "Bareilly, Uttar Pradesh",
        "mobile": "9415678901",
        "blood_group": "A-"
    },
    "madhuri.gupta@abdm": {
        "abha_number": "91-1005-2005-3048",
        "name": "Madhuri Gupta",
        "gender": "F",
        "dob": "1988-10-31",
        "address": "Meerut, Uttar Pradesh",
        "mobile": "9415789012",
        "blood_group": "O+"
    },
    "rahul.tripathi@abdm": {
        "abha_number": "91-1005-2005-3049",
        "name": "Rahul Tripathi",
        "gender": "M",
        "dob": "2002-07-07",
        "address": "Jhansi, Uttar Pradesh",
        "mobile": "9415890123",
        "blood_group": "B-"
    },
    "usha.dubey@abdm": {
        "abha_number": "91-1005-2005-3050",
        "name": "Usha Dubey",
        "gender": "F",
        "dob": "1968-09-12",
        "address": "Aligarh, Uttar Pradesh",
        "mobile": "9415901234",
        "blood_group": "A+"
    },

    # --- KARNATAKA ---
    "karthik.rao@abdm": {
        "abha_number": "91-1006-2006-3051",
        "name": "Karthik Rao",
        "gender": "M",
        "dob": "1992-05-14",
        "address": "Indiranagar, Bengaluru, Karnataka",
        "mobile": "9845011223",
        "blood_group": "O+"
    },
    "deepa.hegde@abdm": {
        "abha_number": "91-1006-2006-3052",
        "name": "Deepa Hegde",
        "gender": "F",
        "dob": "1986-10-20",
        "address": "Malleshwaram, Bengaluru, Karnataka",
        "mobile": "9845122334",
        "blood_group": "B+"
    },
    "manjunath.gowda@abdm": {
        "abha_number": "91-1006-2006-3053",
        "name": "Manjunath Gowda",
        "gender": "M",
        "dob": "1975-01-08",
        "address": "Mysuru, Karnataka",
        "mobile": "9845233445",
        "blood_group": "A+"
    },
    "shilpa.shetty@abdm": {
        "abha_number": "91-1006-2006-3054",
        "name": "Shilpa Shetty",
        "gender": "F",
        "dob": "1994-08-25",
        "address": "Mangaluru, Karnataka",
        "mobile": "9845344556",
        "blood_group": "AB+"
    },
    "praveen.kumar@abdm": {
        "abha_number": "91-1006-2006-3055",
        "name": "Praveen Kumar",
        "gender": "M",
        "dob": "1980-03-17",
        "address": "Hubballi, Karnataka",
        "mobile": "9845455667",
        "blood_group": "O-"
    },
    "laxmi.devi@abdm": {
        "abha_number": "91-1006-2006-3056",
        "name": "Laxmi Bai",
        "gender": "F",
        "dob": "1954-11-29",
        "address": "Belagavi, Karnataka",
        "mobile": "9845566778",
        "blood_group": "B-"
    },
    "raghavendra.joshi@abdm": {
        "abha_number": "91-1006-2006-3057",
        "name": "Raghavendra Joshi",
        "gender": "M",
        "dob": "1969-07-02",
        "address": "Kalaburagi, Karnataka",
        "mobile": "9845677889",
        "blood_group": "A+"
    },
    "vidya.bhat@abdm": {
        "abha_number": "91-1006-2006-3058",
        "name": "Vidya Bhat",
        "gender": "F",
        "dob": "2000-12-11",
        "address": "Udupi, Karnataka",
        "mobile": "9845788990",
        "blood_group": "O+"
    },
    "chetan.reddy@abdm": {
        "abha_number": "91-1006-2006-3059",
        "name": "Chetan Reddy",
        "gender": "M",
        "dob": "1988-04-06",
        "address": "Whitefield, Bengaluru, Karnataka",
        "mobile": "9845899001",
        "blood_group": "B+"
    },
    "soumya.nair@abdm": {
        "abha_number": "91-1006-2006-3060",
        "name": "Soumya Nair",
        "gender": "F",
        "dob": "1997-09-15",
        "address": "Koramangala, Bengaluru, Karnataka",
        "mobile": "9845900112",
        "blood_group": "A-"
    },

    # --- TAMIL NADU ---
    "saravanan.m@abdm": {
        "abha_number": "91-1007-2007-3061",
        "name": "Saravanan M",
        "gender": "M",
        "dob": "1982-06-30",
        "address": "T. Nagar, Chennai, Tamil Nadu",
        "mobile": "9840011223",
        "blood_group": "O+"
    },
    "kavitha.s@abdm": {
        "abha_number": "91-1007-2007-3062",
        "name": "Kavitha Sundaram",
        "gender": "F",
        "dob": "1979-02-14",
        "address": "Mylapore, Chennai, Tamil Nadu",
        "mobile": "9840122334",
        "blood_group": "A+"
    },
    "muthukumar.p@abdm": {
        "abha_number": "91-1007-2007-3063",
        "name": "Muthukumar P",
        "gender": "M",
        "dob": "1966-10-08",
        "address": "Madurai, Tamil Nadu",
        "mobile": "9840233445",
        "blood_group": "B+"
    },
    "revathi.r@abdm": {
        "abha_number": "91-1007-2007-3064",
        "name": "Revathi R",
        "gender": "F",
        "dob": "1991-07-19",
        "address": "Coimbatore, Tamil Nadu",
        "mobile": "9840344556",
        "blood_group": "AB+"
    },
    "karthikeyan.v@abdm": {
        "abha_number": "91-1007-2007-3065",
        "name": "Karthikeyan V",
        "gender": "M",
        "dob": "1987-12-03",
        "address": "Tiruchirappalli, Tamil Nadu",
        "mobile": "9840455667",
        "blood_group": "O-"
    },
    "lakshmi.ammal@abdm": {
        "abha_number": "91-1007-2007-3066",
        "name": "Lakshmi Ammal",
        "gender": "F",
        "dob": "1951-04-21",
        "address": "Salem, Tamil Nadu",
        "mobile": "9840566778",
        "blood_group": "B-"
    },
    "vijayakumar.n@abdm": {
        "abha_number": "91-1007-2007-3067",
        "name": "Vijayakumar N",
        "gender": "M",
        "dob": "1973-09-11",
        "address": "Tirunelveli, Tamil Nadu",
        "mobile": "9840677889",
        "blood_group": "A-"
    },
    "divya.bharathi@abdm": {
        "abha_number": "91-1007-2007-3068",
        "name": "Divya Bharathi",
        "gender": "F",
        "dob": "1999-03-05",
        "address": "Vellore, Tamil Nadu",
        "mobile": "9840788990",
        "blood_group": "O+"
    },
    "senthi.nathan@abdm": {
        "abha_number": "91-1007-2007-3069",
        "name": "Senthil Nathan",
        "gender": "M",
        "dob": "1995-11-27",
        "address": "Erode, Tamil Nadu",
        "mobile": "9840899001",
        "blood_group": "B+"
    },
    "meena.kumari@abdm": {
        "abha_number": "91-1007-2007-3070",
        "name": "Meena Kumari",
        "gender": "F",
        "dob": "1960-08-16",
        "address": "Thanjavur, Tamil Nadu",
        "mobile": "9840900112",
        "blood_group": "A+"
    },

    # --- TELANGANA & ANDHRA PRADESH ---
    "venkat.reddy@abdm": {
        "abha_number": "91-1008-2008-3071",
        "name": "Venkat Reddy",
        "gender": "M",
        "dob": "1981-05-23",
        "address": "Madhapur, Hyderabad, Telangana",
        "mobile": "9848011223",
        "blood_group": "O+"
    },
    "padma.rao@abdm": {
        "abha_number": "91-1008-2008-3072",
        "name": "Padma Rao",
        "gender": "F",
        "dob": "1976-11-17",
        "address": "Banjara Hills, Hyderabad, Telangana",
        "mobile": "9848122334",
        "blood_group": "B+"
    },
    "srinivas.murthy@abdm": {
        "abha_number": "91-1008-2008-3073",
        "name": "Srinivas Murthy",
        "gender": "M",
        "dob": "1964-02-12",
        "address": "Warangal, Telangana",
        "mobile": "9848233445",
        "blood_group": "A+"
    },
    "lavanya.devi@abdm": {
        "abha_number": "91-1008-2008-3074",
        "name": "Lavanya Devi",
        "gender": "F",
        "dob": "1993-08-04",
        "address": "Nizamabad, Telangana",
        "mobile": "9848344556",
        "blood_group": "AB+"
    },
    "ramana.rao@abdm": {
        "abha_number": "91-1008-2008-3075",
        "name": "Ramana Rao",
        "gender": "M",
        "dob": "1958-10-29",
        "address": "Vijayawada, Andhra Pradesh",
        "mobile": "9848455667",
        "blood_group": "O-"
    },
    "swarna.latha@abdm": {
        "abha_number": "91-1008-2008-3076",
        "name": "Swarna Latha",
        "gender": "F",
        "dob": "1985-04-15",
        "address": "Visakhapatnam, Andhra Pradesh",
        "mobile": "9848566778",
        "blood_group": "B-"
    },
    "naresh.babu@abdm": {
        "abha_number": "91-1008-2008-3077",
        "name": "Naresh Babu",
        "gender": "M",
        "dob": "1998-01-20",
        "address": "Guntur, Andhra Pradesh",
        "mobile": "9848677889",
        "blood_group": "A+"
    },
    "anjani.devi@abdm": {
        "abha_number": "91-1008-2008-3078",
        "name": "Anjani Devi",
        "gender": "F",
        "dob": "1967-06-09",
        "address": "Tirupati, Andhra Pradesh",
        "mobile": "9848788990",
        "blood_group": "O+"
    },
    "kiran.kumar.v@abdm": {
        "abha_number": "91-1008-2008-3079",
        "name": "Kiran Kumar V",
        "gender": "M",
        "dob": "1990-12-02",
        "address": "Kurnool, Andhra Pradesh",
        "mobile": "9848899001",
        "blood_group": "B+"
    },
    "pranitha.r@abdm": {
        "abha_number": "91-1008-2008-3080",
        "name": "Pranitha Reddy",
        "gender": "F",
        "dob": "2003-09-18",
        "address": "Secunderabad, Telangana",
        "mobile": "9848900112",
        "blood_group": "A-"
    },

    # --- GUJARAT ---
    "bhavin.patel@abdm": {
        "abha_number": "91-1009-2009-3081",
        "name": "Bhavin Patel",
        "gender": "M",
        "dob": "1984-07-21",
        "address": "Navrangpura, Ahmedabad, Gujarat",
        "mobile": "9825011223",
        "blood_group": "O+"
    },
    "hetal.shah@abdm": {
        "abha_number": "91-1009-2009-3082",
        "name": "Hetal Shah",
        "gender": "F",
        "dob": "1989-03-16",
        "address": "Alkapuri, Vadodara, Gujarat",
        "mobile": "9825122334",
        "blood_group": "A+"
    },
    "chirag.mehta@abdm": {
        "abha_number": "91-1009-2009-3083",
        "name": "Chirag Mehta",
        "gender": "M",
        "dob": "1977-11-09",
        "address": "Surat, Gujarat",
        "mobile": "9825233445",
        "blood_group": "B+"
    },
    "kinjal.desai@abdm": {
        "abha_number": "91-1009-2009-3084",
        "name": "Kinjal Desai",
        "gender": "F",
        "dob": "1996-05-27",
        "address": "Rajkot, Gujarat",
        "mobile": "9825344556",
        "blood_group": "AB+"
    },
    "jagdish.panchal@abdm": {
        "abha_number": "91-1009-2009-3085",
        "name": "Jagdish Panchal",
        "gender": "M",
        "dob": "1961-09-14",
        "address": "Bhavnagar, Gujarat",
        "mobile": "9825455667",
        "blood_group": "O-"
    },
    "varsha.joshi@abdm": {
        "abha_number": "91-1009-2009-3086",
        "name": "Varsha Joshi",
        "gender": "F",
        "dob": "1972-01-30",
        "address": "Jamnagar, Gujarat",
        "mobile": "9825566778",
        "blood_group": "B-"
    },
    "paresh.rawal@abdm": {
        "abha_number": "91-1009-2009-3087",
        "name": "Paresh Vora",
        "gender": "M",
        "dob": "1968-08-05",
        "address": "Gandhinagar, Gujarat",
        "mobile": "9825677889",
        "blood_group": "A-"
    },
    "dhara.trivedi@abdm": {
        "abha_number": "91-1009-2009-3088",
        "name": "Dhara Trivedi",
        "gender": "F",
        "dob": "2001-04-12",
        "address": "Junagadh, Gujarat",
        "mobile": "9825788990",
        "blood_group": "O+"
    },
    "hardik.solanki@abdm": {
        "abha_number": "91-1009-2009-3089",
        "name": "Hardik Solanki",
        "gender": "M",
        "dob": "1993-10-24",
        "address": "Anand, Gujarat",
        "mobile": "9825899001",
        "blood_group": "B+"
    },
    "neeta.parikh@abdm": {
        "abha_number": "91-1009-2009-3090",
        "name": "Neeta Parikh",
        "gender": "F",
        "dob": "1957-12-03",
        "address": "Mehsana, Gujarat",
        "mobile": "9825900112",
        "blood_group": "A+"
    },

    # --- RAJASTHAN ---
    "mahavir.singh@abdm": {
        "abha_number": "91-1010-2010-3091",
        "name": "Mahavir Singh Shekhawat",
        "gender": "M",
        "dob": "1965-03-15",
        "address": "Vaishali Nagar, Jaipur, Rajasthan",
        "mobile": "9414011223",
        "blood_group": "O+"
    },
    "santosh.kanwar@abdm": {
        "abha_number": "91-1010-2010-3092",
        "name": "Santosh Kanwar",
        "gender": "F",
        "dob": "1970-11-22",
        "address": "Jodhpur, Rajasthan",
        "mobile": "9414122334",
        "blood_group": "B+"
    },
    "mukesh.gehlot@abdm": {
        "abha_number": "91-1010-2010-3093",
        "name": "Mukesh Gehlot",
        "gender": "M",
        "dob": "1986-06-18",
        "address": "Udaipur, Rajasthan",
        "mobile": "9414233445",
        "blood_group": "A+"
    },
    "sunita.choudhary@abdm": {
        "abha_number": "91-1010-2010-3094",
        "name": "Sunita Choudhary",
        "gender": "F",
        "dob": "1994-01-09",
        "address": "Kota, Rajasthan",
        "mobile": "9414344556",
        "blood_group": "AB+"
    },
    "rajendra.meena@abdm": {
        "abha_number": "91-1010-2010-3095",
        "name": "Rajendra Meena",
        "gender": "M",
        "dob": "1980-09-27",
        "address": "Bikaner, Rajasthan",
        "mobile": "9414455667",
        "blood_group": "O-"
    },
    "kamla.rathore@abdm": {
        "abha_number": "91-1010-2010-3096",
        "name": "Kamla Rathore",
        "gender": "F",
        "dob": "1952-07-13",
        "address": "Ajmer, Rajasthan",
        "mobile": "9414566778",
        "blood_group": "B-"
    },
    "naresh.sharma@abdm": {
        "abha_number": "91-1010-2010-3097",
        "name": "Naresh Sharma",
        "gender": "M",
        "dob": "1991-04-05",
        "address": "Alwar, Rajasthan",
        "mobile": "9414677889",
        "blood_group": "A-"
    },
    "mamta.jangid@abdm": {
        "abha_number": "91-1010-2010-3098",
        "name": "Mamta Jangid",
        "gender": "F",
        "dob": "2000-08-30",
        "address": "Sikar, Rajasthan",
        "mobile": "9414788990",
        "blood_group": "O+"
    },
    "surendra.yadav@abdm": {
        "abha_number": "91-1010-2010-3099",
        "name": "Surendra Yadav",
        "gender": "M",
        "dob": "1978-02-17",
        "address": "Bhilwara, Rajasthan",
        "mobile": "9414899001",
        "blood_group": "B+"
    },
    "anita.jain@abdm": {
        "abha_number": "91-1010-2010-3100",
        "name": "Anita Jain",
        "gender": "F",
        "dob": "1987-10-10",
        "address": "Pali, Rajasthan",
        "mobile": "9414900112",
        "blood_group": "A+"
    },

    # --- KERALA ---
    "thomas.mathew@abdm": {
        "abha_number": "91-1011-2011-3101",
        "name": "Thomas Mathew",
        "gender": "M",
        "dob": "1964-05-25",
        "address": "Kaloor, Kochi, Kerala",
        "mobile": "9447011223",
        "blood_group": "O+"
    },
    "lakshmi.nair@abdm": {
        "abha_number": "91-1011-2011-3102",
        "name": "Lakshmi Nair",
        "gender": "F",
        "dob": "1990-12-14",
        "address": "Pattom, Thiruvananthapuram, Kerala",
        "mobile": "9447122334",
        "blood_group": "A+"
    },
    "mohammed.ali@abdm": {
        "abha_number": "91-1011-2011-3103",
        "name": "Mohammed Ali",
        "gender": "M",
        "dob": "1975-08-03",
        "address": "Kozhikode, Kerala",
        "mobile": "9447233445",
        "blood_group": "B+"
    },
    "annamma.joseph@abdm": {
        "abha_number": "91-1011-2011-3104",
        "name": "Annamma Joseph",
        "gender": "F",
        "dob": "1953-02-19",
        "address": "Kottayam, Kerala",
        "mobile": "9447344556",
        "blood_group": "AB+"
    },
    "rahul.krishna@abdm": {
        "abha_number": "91-1011-2011-3105",
        "name": "Rahul Krishna",
        "gender": "M",
        "dob": "1998-09-08",
        "address": "Thrissur, Kerala",
        "mobile": "9447455667",
        "blood_group": "O-"
    },

    # --- BIHAR ---
    "sunita.devi@abdm": {
        "healthIdNumber": "91-1002-2002-3011",
        "healthId": "sunita.devi@abdm",
        "name": "Sunita Devi",
        "gender": "F",
        "yearOfBirth": "1955",
        "monthOfBirth": "03",
        "dayOfBirth": "24",
        "address": "Kankarbagh",
        "districtName": "Patna",
        "stateName": "Bihar",
        "pincode": "800020",
        "mobile": "9431012345",
        "profilePhoto": ""
    },
    "amit.kumar.jha@abdm": {
        "healthIdNumber": "91-1002-2002-3012",
        "healthId": "amit.kumar.jha@abdm",
        "name": "Amit Kumar Jha",
        "gender": "M",
        "yearOfBirth": "1983",
        "monthOfBirth": "05",
        "dayOfBirth": "11",
        "address": "Darbhanga City",
        "districtName": "Darbhanga",
        "stateName": "Bihar",
        "pincode": "846004",
        "mobile": "9431123456",
        "profilePhoto": ""
    },

    # --- MAHARASHTRA ---
    "aarav.sharma@abdm": {
        "healthIdNumber": "91-1003-2003-3021",
        "healthId": "aarav.sharma@abdm",
        "name": "Aarav Sharma",
        "gender": "M",
        "yearOfBirth": "2018",
        "monthOfBirth": "11",
        "dayOfBirth": "05",
        "address": "Andheri West",
        "districtName": "Mumbai",
        "stateName": "Maharashtra",
        "pincode": "400053",
        "mobile": "9820011223",
        "profilePhoto": ""
    },
    "pradeep.kulkarni@abdm": {
        "healthIdNumber": "91-1003-2003-3022",
        "healthId": "pradeep.kulkarni@abdm",
        "name": "Pradeep Kulkarni",
        "gender": "M",
        "yearOfBirth": "1960",
        "monthOfBirth": "07",
        "dayOfBirth": "14",
        "address": "Kothrud",
        "districtName": "Pune",
        "stateName": "Maharashtra",
        "pincode": "411038",
        "mobile": "9820122334",
        "profilePhoto": ""
    },

    # --- DELHI NCR ---
    "harpreet.singh@abdm": {
        "healthIdNumber": "91-1004-2004-3031",
        "healthId": "harpreet.singh@abdm",
        "name": "Harpreet Singh",
        "gender": "M",
        "yearOfBirth": "1980",
        "monthOfBirth": "08",
        "dayOfBirth": "15",
        "address": "Tilak Nagar",
        "districtName": "New Delhi",
        "stateName": "Delhi",
        "pincode": "110018",
        "mobile": "9811011223",
        "profilePhoto": ""
    },
    "divya.kapoor@abdm": {
        "healthIdNumber": "91-1004-2004-3032",
        "healthId": "divya.kapoor@abdm",
        "name": "Divya Kapoor",
        "gender": "F",
        "yearOfBirth": "1991",
        "monthOfBirth": "04",
        "dayOfBirth": "09",
        "address": "Rohini Sector 9",
        "districtName": "New Delhi",
        "stateName": "Delhi",
        "pincode": "110085",
        "mobile": "9811122334",
        "profilePhoto": ""
    }
}

# --- LOOKUP HELPER UTILITIES ---

def lookup_patient_by_identifier(query: str) -> dict | None:
    """
    Finds a patient in the mock registry by:
    1. ABHA Address (e.g. 'ramesh.kumar@abdm')
    2. 14-digit ABHA Number (e.g. '91-1001-2001-3001')
    3. 10-digit Phone Number (e.g. '9088260058')
    """
    clean_query = query.replace("-", "").strip()
    
    # Direct match on ABHA address key
    if query.strip() in MOCK_ABHA_REGISTRY:
        return MOCK_ABHA_REGISTRY[query.strip()].copy()
    
    # Secondary search on healthIdNumber or mobile
    for abha_addr, data in MOCK_ABHA_REGISTRY.items():
        clean_health_id = data["healthIdNumber"].replace("-", "")
        if clean_health_id == clean_query or data["mobile"] == clean_query:
            return data.copy()
            
    return None