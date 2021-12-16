const functions = require("firebase-functions");

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const { ApolloServer, AuthenticationError } = require('apollo-server-express');
const { ApolloServerPluginLandingPageDisabled } = require('apollo-server-core');

const { typeDefs } = require("./typeDefs");
const { resolvers } = require("./resolvers");

var admin = require("firebase-admin");
admin.initializeApp({credential: admin.credential.applicationDefault()});

const { initializeApp } = require('firebase/app');
const firebaseConfig = require('./config');
const app = express();

async function startExpressApolloServer() {
    const firebaseApp = initializeApp(firebaseConfig);
    
    // graphql endpoint
    app.use(
        cors(),
        bodyParser.json(),
        cookieParser(),
    );
    
    // create apollo server
    const server = new ApolloServer(
        {   
            typeDefs, 
            resolvers,
            context: async ({ req }) => {
                //get the user token from the headers
                const { authorization } = req.headers;

                if (!authorization) {
                    return { firebaseApp, admin };
                } else {
                    if (!authorization.startsWith('Bearer '))
                        throw new AuthenticationError('Unauthorized');

                    const split = authorization.split('Bearer ')
                    if (split.length !== 2)
                        throw new AuthenticationError('Unauthorized');

                    const idToken = split[1];

                    try {
                        const decodedToken = await admin.auth().verifyIdToken(idToken);
                        const uid = decodedToken.uid;
                        return { uid, firebaseApp, admin };
                    } catch (err) {
                        throw new AuthenticationError('Unauthorized');
                    }
                }
            },
            plugins: [ ApolloServerPluginLandingPageDisabled()]
        }
    );
    
    await server.start();
    server.applyMiddleware({ app, path: '/' });
}


exports.graphql = functions.https.onRequest(async (req, res) => {
    await startExpressApolloServer();
    return await app(req, res);
});

exports.processSignUp = functions.auth.user().onCreate( async (user) => {
    const store = admin.firestore();
    const userRef = store.collection('users').doc(user.uid);
    await userRef.set({
        email: user.email,
        isEmailVerified: user.emailVerified,
        creationDate: new Date().getTime()
    });
});

exports.processDeleteUser = functions.auth.user().onDelete(async (user) => {
    const store = admin.firestore();
    const userRef = store.collection('users').doc(user.uid);
    await userRef.delete();
});