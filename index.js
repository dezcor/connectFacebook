
// configuracion
const express = require('express');
const bodyParser = require('body-parser');
const passport = require('passport');
const cookieSession = require('cookie-session');
const FacebookStrategy = require('passport-facebook').Strategy;
const graph  = require('fbgraph');
const hbs = require('express-hbs');

const app = express();
require('dotenv').config();


const User = require('./models/User');

//BodyParser
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended:true}));

// Cookie Session parse
app.use(cookieSession({keys:['Liset','es Mi vidad']}))

app.use(passport.initialize());
app.use(passport.session());

// engine hbs
app.engine('hbs',hbs.express4({
    layoutsDir: __dirname + '/views/layout/',
    partialsDir: __dirname + '/views/partials/'
}));
app.set('view engine','hbs');
app.set('views',__dirname+'/views');


// Configurar las autenticación
passport.use(new FacebookStrategy({
    clientID: process.env.APPID,
    clientSecret: process.env.APPSECRECT,
    callbackURL: 'http://localhost:8000/auth/facebook/callback'
},(accessToken,refreshToken,profile,cb)=>{
    // Guardarlo en DB

    User.findOrCreate({uid:profile.id},{
        name:profile.displayName,
        profile: 'facebook',
        accessToken: accessToken
    }, (err,user)=>{
        // Guardar al usuari en la session

        //Mandar a llamar cb, completa la autentiacion
        cb(null,user);
    })
    
}));


passport.serializeUser((user,done)=>{
    done(null,user);
})

//Definir como se retorna el usuario de la sesion
passport.deserializeUser((user,done)=>{
    done(null,user);
})

app.set('port',process.env.PORT || 8000);

app.get('/',async (req,res)=>{
    posts = []
    friends = [];
    if( typeof req.session.passport === 'undefined' || !req.session.passport.user){
        var user = false;
        res.render('index',{user,posts});
    } else{
        var user = true;

        graph.setAccessToken(req.session.passport.user.accessToken);

        await graph.get('/me/friends',async (err,resG)=>{
            if(err){
                posts = [];
                console.log(err)
            }

            friends = await resG.data.map((friend,index)=>{
                return friend.id;
            });
            
            await graph.get('/me/posts', async (err,resG)=>{
                if(err){
                    posts = [];
                    console.log(err)
                }
                posts = await resG.data;
    
                User.find({uid:{
                    $in: friends
                }},(err,friends)=>{
                    res.render('index',{user,posts,friends});
                });
    
            })
            
        })

    }
});

// Definir el inicio de sesion
app.get('/auth/facebook',passport.authenticate('facebook',{scope:['user_posts','user_friends']}));

app.get('/auth/facebook/callback',
    passport.authenticate('facebook',{failureRedirect:'/'}),
    (req,res)=>{
        console.log(req.session);
        res.redirect('/');
    })

// Vista para cerrar secion
app.get('/auth/close',(req,res)=>{
    req.logOut();
    res.redirect('/');
})

app.post('/logro',(req,res)=>{
    const logro = req.body.logro;
    graph.setAccessToken(req.session.passport.user.accessToken);

    graph.post('/feed',{message:logro},(err,resG)=>{
        console.log(resG);
        res.redirect('/');
    })
});


app.listen(app.get('port'),()=>{
    console.log(`listening in port ${app.get('port')}`)
})