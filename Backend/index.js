const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Sequelize, DataTypes, Model } = require('sequelize');
const cors = require('cors');
// const { authenticateToken } = require('./middleware/auth');

const app = express();
const PORT = 3000;
const JWT_SECRET = 'your_secret_key_here';

// Set up Sequelize
const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: ':memory:',  // Use this format for in-memory databases
  });
  

// Database Models
class Student extends Model {}

Student.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    fullName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    passwordHash: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    phoneNumber: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    parentContact: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    dob: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    highSchool: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    expressionOfInterestDate: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    psychometricScores: {
      type: DataTypes.STRING,
    },
    skillRating: {
      type: DataTypes.FLOAT,
    },
    reportedIncome: {
      type: DataTypes.FLOAT,
    },
  },
  {
    sequelize,
    modelName: 'Student',
  }
);

class CodingTestScore extends Model {}

CodingTestScore.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    studentId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    score: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    date: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    modelName: 'CodingTestScore',
  }
);

class Project extends Model {}

Project.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    studentId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    projectName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.STRING,
    },
  },
  {
    sequelize,
    modelName: 'Project',
  }
);

class Admin extends Model {}

Admin.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    passwordHash: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  },
  {
    sequelize,
    modelName: 'Admin',
  }
);

 
const corsOptions = {
  origin: true,
  optionsSuccessStatus: 200, 
};

// Middleware
app.use(express.json());
app.use(cors(corsOptions))

//middleware
const authenticateAdmin = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Access denied. No token provided.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    // Assuming the admin role is set in the token
    if (decoded.role !== 'admin') {
      return res.status(403).json({ message: 'Access forbidden. Admins only.' });
    }
    req.user = decoded; // Store decoded token data in request
    next();
  } catch (error) {
    return res.status(400).json({ message: 'Invalid token.' });
  }
};


// Routes
app.post('/register', async (req, res) => {
  try {
    const { fullName, email, password, phoneNumber, parentContact, dob, highSchool } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const student = await Student.create({
      fullName,
      email,
      passwordHash: hashedPassword,
      phoneNumber,
      parentContact,
      dob: new Date(dob),
      highSchool,
    });
    console.log(student)
    res.status(201).json({ message: 'Student registered successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Error registering student' });
  }
});

app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const student = await Student.findOne({ where: { email } });
    if (student && (await bcrypt.compare(password, student.passwordHash))) {
      const token = jwt.sign({ id: student.id }, JWT_SECRET);
      res.json({ accessToken: token });
    } else {
      res.status(401).json({ message: 'Invalid credentials' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Error logging in' });
  }
});

app.post('/admin', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if the password is provided
    if (!password) {
      return res.status(400).json({ message: 'Password is required' });
    }

    // Check if the admin already exists
    const existingAdmin = await Admin.findOne({ where: { email } });

    if (existingAdmin) {
      // Admin exists, attempt to log in
      const isValidPassword = await bcrypt.compare(password, existingAdmin.passwordHash);
      if (isValidPassword) {
        const token = jwt.sign({ id: existingAdmin.id, role: 'admin' }, JWT_SECRET);
        return res.json({ accessToken: token });
      } else {
        return res.status(401).json({ message: 'Invalid credentials' });
      } 
    } else {
      // Admin does not exist, register new admin
      const hashedPassword = await bcrypt.hash(password, 10);
      const admin = await Admin.create({
        email,
        passwordHash: hashedPassword,
      });
      const token = jwt.sign({ id: admin.id, role: 'admin' }, JWT_SECRET);
      return res.status(201).json({ accessToken: token, message: 'Admin registered successfully' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Error processing request' });
  }
});


app.get('/statistics', authenticateAdmin, async (req, res) => {
  try {
    // Aggregate data for statistics
    const totalStudents = await Student.count();
    const totalReportedIncome = await Student.sum('reportedIncome');
    // const averageSkillRating = await Student.avg('skillRating');

    const statistics = {
      totalStudents,
      totalReportedIncome: totalReportedIncome || 0,  // Handle null cases
      // averageSkillRating: averageSkillRating || 0,    // Handle null cases
    };

    res.status(200).json(statistics);
  } catch (error) {
    console.error('Error fetching statistics:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

app.post('/add_project', async (req, res) => {
  try {
    const studentId = req.user.id;
    const { projectName, description } = req.body;
    await Project.create({ studentId, projectName, description });
    res.status(201).json({ message: 'Project added successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Error adding project' });
  }
});

app.post('/report_income', async (req, res) => {
  try {
    const studentId = req.user.id;
    const { income } = req.body;
    await Student.update({ reportedIncome: income }, { where: { id: studentId } });
    res.json({ message: 'Income reported successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Error reporting income' });
  }
});

app.post('/add_coding_score', async (req, res) => {
  try {
    const studentId = req.user.id;
    const { score } = req.body;
    await CodingTestScore.create({ studentId, score });
    res.status(201).json({ message: 'Coding score added successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Error adding coding score' });
  }
});

app.post('/assign_project', async (req, res) => {
  try {
    const studentId = req.user.id;
    const { projectName, description } = req.body;
    await Project.create({ studentId, projectName, description });
    res.status(201).json({ message: 'Project assigned successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Error assigning project' });
  }
});

// Start server
(async () => {
  await sequelize.sync();
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
})();
