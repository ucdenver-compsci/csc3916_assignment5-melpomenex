/*
CSC3916 HW4
File: Server.js
Description: Web API scaffolding for Movie API
 */

var express = require('express');
var bodyParser = require('body-parser');
var passport = require('passport');
var authController = require('./auth');
var authJwtController = require('./auth_jwt');
var jwt = require('jsonwebtoken');
var cors = require('cors');
var User = require('./Users');
var Movie = require('./Movies');
var Review = require('./Reviews');

var app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.use(passport.initialize());

var router = express.Router();

function getJSONObjectForMovieRequirement(req) {
    var json = {
        headers: "No headers",
        key: process.env.UNIQUE_KEY,
        body: "No body"
    };

    if (req.body != null) {
        json.body = req.body;
    }

    if (req.headers != null) {
        json.headers = req.headers;
    }

    return json;
}

router.post('/signup', function(req, res) {
    if (!req.body.username || !req.body.password) {
        res.json({success: false, msg: 'Please include both username and password to signup.'})
    } else {
        var user = new User();
        user.name = req.body.name;
        user.username = req.body.username;
        user.password = req.body.password;

        user.save(function(err){
            if (err) {
                if (err.code == 11000)
                    return res.json({ success: false, message: 'A user with that username already exists.'});
                else
                    return res.json(err);
            }

            res.json({success: true, msg: 'Successfully created new user.'})
        });
    }
});

router.post('/signin', function (req, res) {
    var userNew = new User();
    userNew.username = req.body.username;
    userNew.password = req.body.password;

    User.findOne({ username: userNew.username }).select('name username password').exec(function(err, user) {
        if (err) {
            res.send(err);
        }

        user.comparePassword(userNew.password, function(isMatch) {
            if (isMatch) {
                var userToken = { id: user.id, username: user.username };
                var token = jwt.sign(userToken, process.env.SECRET_KEY);
                res.json ({success: true, token: 'JWT ' + token});
            }
            else {
                res.status(401).send({success: false, msg: 'Authentication failed.'});
            }
        })
    })
});

// GET MOVIES
router.get('/movies', authJwtController.isAuthenticated, (req, res) => {
    Movie.find({ title: { $exists: true } })
        .then(movies => {
            res.status(200).json(movies);
        })
        .catch(error => {
            console.error('Error finding movies:', error);
            res.status(500).json({ error: 'An error occurred while finding movies' });
        });
});

// POST MOVIES
router.post('/movies', authJwtController.isAuthenticated, (req, res) => {
    const { title, releaseDate, genre, actors } = req.body;
    const newMovie = new Movie({ title, releaseDate, genre, actors });

    newMovie.save()
        .then(savedMovie => {
            res.status(200).json(savedMovie);
        });
});


router.route('/movies/:id')
    .get(async (req, res) => {
        console.log("GET /movies");
        const { id } = req.params;
        var dict = [];

        try {
            const movie = await Movie.findOne({ _id: id });
            if (!movie) {
                console.log("Movie not found.");
                res.status(400).json({ success: false, msg: 'Movie not in database' });
                return;
            }
            dict.push({
                key: 'movie',
                value: movie
            });

            if (req.query.reviews) {
                const reviews = await Review.find({ movieId: id });
                dict.push({
                    key: 'reviews',
                    value: reviews
                });
            }
            res.json(dict);
        } catch (error) {
            console.error(error);
            res.status(500).json({ success: false, msg: 'Server error' });
        }
    })

    .put(authJwtController.isAuthenticated,(req, res) => {
        console.log("PUT /movies");
        const { id } = req.params;
        const { title, releaseDate, genre, actors } = req.body;
        const newMovie = new Movie({ title, releaseDate, genre, actors });
        
        Movie.updateOne( { _id : id }, newMovie, function(err){
            if (err) {
                console.log("Failed to update movie.");
                return res.json(err);
            }
            console.log("Updated movie.");
            res.json({success: true, msg: 'Successfully updated movie.'})
        });
        
    })
    .delete(authJwtController.isAuthenticated,(req, res) => {
        const { id } = req.params;

        Movie.deleteOne( { _id: id } , function(err){
            if (err) {
                console.log("Failed to delete movie.");
                return res.json(err);
            }
            console.log("Movie deleted.");
            res.json({success: true, msg: 'Successfully deleted movie.'})
        });
    })
    .all((req,res)=> {
        // Any other HTTP Method
        // Returns a message stating that the HTTP method is unsupported.
        res.status(405).send({ message: 'HTTP method not supported.' });
    });

// GET REVIEWS
router.get('/reviews', (req, res) => {
    console.log("Returning reviews");
    Review.find(req.query, function(err, movie) {
            if(err) {
                console.log("Failed to return reviews.");
                res.status(500).json({ 'message': 'Failed to get reviews.' });
            } else {
                console.log("Returned reviews successfully.");
                res.json(movie);
            }
        });
    })

// POST REVIEWS
router.post('/reviews', authJwtController.isAuthenticated, (req, res) => {
    const { movieId, username, review, rating } = req.body;
    const newReview = new Review({ movieId, username, review, rating });

    newReview.save()
        .then(savedReview => {
            res.status(200).json(savedReview);
            console.log('Review created!');
        });
});

app.use('/', router);
app.listen(process.env.PORT || 8080);
module.exports = app; // for testing only


