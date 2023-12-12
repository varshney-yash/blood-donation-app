const express = require('express');
const mongoose = require('mongoose');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');
const fetch = require('node-fetch');
const ejs = require('ejs');
const app = express();
const fs = require('fs');

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(__dirname));
app.use(require('cookie-session')({ secret: 'your-secret-key', resave: true, saveUninitialized: true }));
app.use(passport.initialize());
app.use(passport.session());
app.set('view engine', 'ejs');

const username = 'adddmin'
const password = 'vhgTfv8xom24Kkn4'
const encodedUsername = encodeURIComponent(username);
const encodedPassword = encodeURIComponent(password);

const connectionString = `mongodb+srv://${encodedUsername}:${encodedPassword}@cluster0.wvqfpmi.mongodb.net/?retryWrites=true&w=majority`;

mongoose.connect(connectionString)
const userSchema = new mongoose.Schema({
    googleId: { type: String, index: true, unique: true },
    name: String,
    email: { type: String, index: true, unique: true },
    profilePic: String,
    latitude: Number,
    longitude: Number,
    preferred_locations: [
        {
            latitude: Number,
            longitude: Number,
            loc_name: String
        }
    ],
});

const User = mongoose.model('User', userSchema);

passport.use(new GoogleStrategy({
  clientID: '545538491506-2101re9bk71nn0ge6qj5p9vhflc261eq.apps.googleusercontent.com',
  clientSecret: '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',
  callbackURL: 'http://https://donate-blood.onrender.com/auth/google/callback',
},
async (accessToken, refreshToken, profile, done) => {
    try {
      const existingUser = await User.findOne({ googleId: profile.id });

      if (existingUser) {
        done(null, existingUser);
      } else {
        const newUser = new User({
          googleId: profile.id,
          name: profile.displayName,
          email: profile.emails[0].value,
          profilePic: profile.photos[0].value,
        });

        await newUser.save();
        sendWelcomeEmail(newUser);
        done(null, newUser);
      }
    } catch (error) {
      console.error(error);
      done(error, null);
    }
}));

passport.serializeUser((user, done) => done(null, user.id));

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    console.error(error);
    done(error, null);
  }
});




app.get('/login', passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/' }),
  (req, res) => {
    res.redirect('/');
  }
);

app.get('/',(req, res) => {
  if (req.isAuthenticated()){
    res.redirect('profile')
  } else{
    res.redirect('/home');
  }
});

app.get('/home', (req, res) => {
    res.sendFile(path.join(__dirname, 'homepage.html'));
});

app.get('/profile',(req,res)=>{
  if(req.isAuthenticated()){
    const user = req.user;
    res.render('profile', { user });
  } else {
    res.redirect('/')
  }``
})

const transporter = require('./emailConfig'); 

function sendWelcomeEmail(user) {
    const emailTemplate = fs.readFileSync('./views/welcomeEmailTemplate.ejs', 'utf-8');
    const renderedEmail = ejs.render(emailTemplate, { userName: user.name });

    const mailOptions = {
        from: '17yashvarshney@gmail.com', 
        to: user.email,
        subject: 'Welcome to Our Platform!',
        html: renderedEmail,
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.error('Error sending welcome email:', error);
        } else {
            console.log('Welcome email sent:', info.response);
        }
    });
}

app.get('/logout', (req, res) => {
if (req.user && req.user.tokens && req.user.tokens.access_token) {
    const { access_token } = req.user.tokens;
    try {
    revokeGoogleAccessToken(access_token);
    } catch (error) {
    console.error('Error revoking access token:', error);
    }
}

req.logout(() => {
    res.redirect('/home');
});
});
  

async function revokeGoogleAccessToken(accessToken) {
const axios = require('axios');
const clientId = '545538491506-2101re9bk71nn0ge6qj5p9vhflc261eq.apps.googleusercontent.com'; 
const revokeUrl = `https://accounts.google.com/o/oauth2/revoke?token=${accessToken}`;

await axios.get(revokeUrl, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
});
}

app.get('/dashboard', (req, res) => {
    if (req.isAuthenticated()) {
      res.sendFile(path.join(__dirname, 'client.html'));
    } else {
      res.redirect('/login');
    }
});

app.get('/add-pre', (req, res) => {
    if (req.isAuthenticated()) {
      res.sendFile(path.join(__dirname, 'loc.html'));
    } else {
      res.redirect('/login');
    }
});

app.post('/api/saveLocation', async (req, res) => {
    try {
        const { latitude, longitude } = req.body;
        const { name, profilePic, email } = req.user;
        let user = await User.findOne({ email });
        if (!user) {
            user = new User({
                name,
                profilePic,
                email,
                latitude,
                longitude,
            });
        } else {
            user.latitude = latitude;
            user.longitude = longitude;
        }
        await user.save();

        res.json({ success: true, message: 'Location saved successfully.' });
    } catch (error) {
        console.error('Error saving location:', error);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
});



app.get('/api/getPref', async (req, res) => {
    try {
        const email = req.user.email;
        let user = await User.findOne({ email });
        let pref; 

        if (user) {
            pref = user.preferred_locations.map(location => ({
                lat: location.latitude,
                lng: location.longitude,
                name: location.loc_name
            }));
        }
        
        res.json({ success: true, data: pref });
    } catch (error) {
        res.status(500).json({ success: false, message: error });
    }
});

app.post('/api/updatePref', async (req, res) => {
    try {
        const email = req.user.email;
        const preferences = req.body.preferences;

        let user = await User.findOne({ email });

        if (user) {
            user.preferred_locations = preferences.map(pref => ({
                latitude: pref.lat,
                longitude: pref.lng,
                loc_name: pref.name
            }));

            user.preferred_locations = user.preferred_locations.slice(0, 5);

            await user.save();

            res.json({ success: true, message: 'Preferences updated successfully.' });
        } else {
            res.status(404).json({ success: false, message: 'User not found.' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.post('/api/getNearbyBloodBanks', async (req, res) => {
    const { latitude, longitude } = req.body;

    const apiUrl = `https://www.eraktkosh.in/BLDAHIMS/bloodbank/nearbyBB.cnt?hmode=GETNEARBYBLOODBANK&latitude=${latitude}&longitude=${longitude}`;
  
    try {
      const response = await fetch(apiUrl);
      const data = await response.json();
      console.log(data)
      res.json(data);
    } catch (error) {
      console.error('Error fetching nearby blood banks:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
});

const PORT = process.env.PORT || 3030;

// your code

app.listen(PORT, () => {
  console.log(`server started on port ${PORT}`);
});