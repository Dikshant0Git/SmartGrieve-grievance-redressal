const DEPARTMENTS = {
  MUNICIPAL: {
    name: "Municipal Corporation",
    code: "MUNC",
    categories: ["Sanitation", "Roads", "Water"],
    sla: {
      Sanitation: 3,   // days
      Roads: 7,
      Water: 2
    }
  },
  ELECTRICITY: {
    name: "Electricity Board",
    code: "ELEC",
    categories: ["Electricity"],
    sla: {
      Electricity: 1
    }
  },
  HEALTH: {
    name: "Health Department",
    code: "HLTH",
    categories: ["Health"],
    sla: {
      Health: 2
    }
  },
  TRANSPORT: {
    name: "Transport Department",
    code: "TRNS",
    categories: ["Transport"],
    sla: {
      Transport: 5
    }
  },
  REVENUE: {
    name: "Revenue Department",
    code: "REVN",
    categories: ["Housing", "Land"],
    sla: {
      Housing: 10,
      Land: 10
    }
  },
  GENERAL: {
    name: "General Administration",
    code: "GENL",
    categories: ["Corruption", "Other"],
    sla: {
      Corruption: 3,
      Other: 7
    }
  }
}

// This is what AI service returns → maps to department code
const CATEGORY_TO_DEPT = {
  "Sanitation": "MUNC",
  "Roads":      "MUNC",
  "Water":      "MUNC",
  "Electricity":"ELEC",
  "Health":     "HLTH",
  "Transport":  "TRNS",
  "Housing":    "REVN",
  "Land":       "REVN",
  "Corruption": "GENL",
  "Other":      "GENL"
}

module.exports = { DEPARTMENTS, CATEGORY_TO_DEPT }