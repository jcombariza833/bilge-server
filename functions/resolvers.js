const { AuthenticationError, UserInputError} = require('apollo-server-express');

const { getFirestore, Timestamp, FieldValue } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');

const resolvers = {
    Query: {
        instructors: async (_, args , { uid, admin }) => {
            var result;
            const store = admin.firestore();
            await userVerification(store, uid);

            const userCollection = await store
            .collection('users')
            .where('role', '==', 'INSTRUCTOR')
            .get();

            if (!userCollection.empty) {
                result = userCollection.docs.map(doc => doc.data());
            } else {
                throw new Error('Instructors do not exist');
            }
        
            return result;
        },
        instructorBy: async (_, { username } , { uid, admin }) => {
            const store = admin.firestore();
            const instructorsCollectionRef = store.collection('users');
            const instructorsCollection = await instructorsCollectionRef.where('username', '==',username).get();
            var instructorDoc;

            if(instructorsCollection.empty) { throw new Error('Instructor does not exist'); }

            for (let doc of instructorsCollection.docs) { 
                const userRef = store.collection('users').doc(doc.id);
                const userDoc = await userRef.get()
                 var user = userDoc.data();

                if(!userDoc.exists) { throw new Error('User does not exist'); }

                const courseCollectionRef = userRef.collection('courses');
                const courseCollection = await courseCollectionRef.get();

                if(!courseCollection.empty) { 
                    var courses = [];
                    for (let doc of courseCollection.docs) {
                        const courseRef = courseCollectionRef.doc(doc.id);
                        const sectionCollectionRef = courseRef.collection('sections');
        
                        const sectionCollection = await sectionCollectionRef.get();
                        var course = doc.data();

                        if(!sectionCollection.empty) { 
                            var sections = [];
                            for (let doc of sectionCollection.docs) {
                                sections.push(doc.data())
                            }
                            course = { ...course, sections: sections};
                        }
                        courses.push(course);
                    }
                    user = { ...user, courses: courses };
                }
                instructorDoc = user
            }

            return instructorDoc;
        },
        students: async (_, {sectionCode} , {uid, admin}) => {
            var result = [];
            const store = admin.firestore();
            await userVerification(store, uid);
            const query = store.collection('users').where('role', '==', 'STUDENT')
                            
            const userCollection = await query.get();
            if (!userCollection.empty) {
                for (let doc of userCollection.docs) {
                    const user = doc.data();
                    const enrolled = user.enrolled;

                    if (!enrolled) { throw new Error('No sections enrolled'); }
            
                    const sections = enrolled.filter(enroll => enroll.section.code === sectionCode);
                    if (sections.length > 0) {
                        result.push(user);
                    }
                }
            }
            return result;
        },
        instructor: async (_, args , {uid, admin}) => {
            const store = admin.firestore();
            const userRef = store.collection('users').doc(uid);
            const userDoc = await userRef.get()
            var user = userDoc.data();

            if(!userDoc.exists) { throw new Error('User does not exist'); }

            const courseCollectionRef = userRef.collection('courses');
            const courseCollection = await courseCollectionRef.get();

            if(!courseCollection.empty) { 
                var courses = [];
                for (let doc of courseCollection.docs) {
                    const courseRef = courseCollectionRef.doc(doc.id);
                    const sectionCollectionRef = courseRef.collection('sections');
    
                    const sectionCollection = await sectionCollectionRef.get();
                    var course = doc.data();

                    if(!sectionCollection.empty) { 
                        var sections = [];
                        for (let doc of sectionCollection.docs) {
                            sections.push(doc.data())
                        }
                        course = { ...course, sections: sections};
                    }
                    courses.push(course);
                }
                user = { ...user, courses: courses };
            }

            return user;
        },
        student: async (_, args , {uid, admin}) => {
            const store = admin.firestore();
            const userRef = store.collection('users').doc(uid);
            const userDoc = await userRef.get()
            var user = userDoc.data()
           
            if(!userDoc.exists) { throw new Error('User does not exist'); }

            const courseCollectionRef = userRef.collection('courses');
            const courseCollection = await courseCollectionRef.get();

            if(!courseCollection.empty) { 
                var courses = [];
                for (let doc of courseCollection.docs) {
                    const courseRef = courseCollectionRef.doc(doc.id);
                    const sectionCollectionRef = courseRef.collection('sections');
    
                    const sectionCollection = await sectionCollectionRef.get();
                    
                    if(!sectionCollection.empty) { throw new Error('Section does not exist'); }
                    var sections = [];
                    for (let doc of sectionCollection.docs) {
                        sections.push(doc.data())
                    }

                    var course = doc.data();
                    course = { ...course, sections: sections};
                    courses.push(course);
                }
                user = { ...user, courses: courses };
            }

            return user;
        }
    },
    Mutation: {
        updateRole: async (_, { role }, { uid, admin }) => {
            const store = admin.firestore();
            const userRef = store.collection('users').doc(uid);
            const response = await userRef.update( {role: role} );

            if (!response) { throw new Error('Unable to update profile'); }

            return "Successful profile update";
        },
        updateProfile: async (_, { profile }, { uid, admin }) => {

            const store = admin.firestore();
            const userRef = store.collection('users').doc(uid);

            const { username } = profile;

            await usernameVerification(store,username);
            const response = await userRef.update( profile );
            if (!response) { throw new Error('Unable to update profile'); }

            return "Successful profile update";
        },
        createCourse: async (_, { course }, { uid, admin }) => {
            const store = admin.firestore();
            const userRef = store.collection('users').doc(uid);
            const userDoc = await userRef.get()

            if(!userDoc.exists) { throw new Error('User does not exist'); }

            const courseCollectionRef = userRef.collection('courses');
            const courseCollection = await courseCollectionRef.where('code', '==', course.code).get();

            if(!courseCollection.empty) { throw new Error('Course already exist'); }

            await courseCollectionRef.add(course);
            
            return "Course created successfully";
        },
        deleteCourse: async (_, { courseCode }, { uid,  admin }) => {
            const store = admin.firestore();
            const userRef = store.collection('users').doc(uid);
            const userDoc = await userRef.get()

            if(!userDoc.exists) { throw new Error('User does not exist'); }

            const courseCollectionRef = userRef.collection('courses');
            const courseCollection = await courseCollectionRef.where('code', '==',courseCode).get();

            if(courseCollection.empty) { throw new Error('Course does not exist'); }

            for (let doc of courseCollection.docs) {
                await deleteCollection(store,courseCollectionRef.doc(doc.id).collection("sections"));
                await courseCollectionRef.doc(doc.id).delete();
            }

            return "Course removed successfully";
        },
        addSection: async (_, { section, courseCode }, { uid, admin }) => {
            const store = admin.firestore();
            const userRef = store.collection('users').doc(uid);
            const userDoc = await userRef.get()

            if(!userDoc.exists) { throw new Error('User does not exist'); }

            const courseCollectionRef = userRef.collection('courses');
            const courseCollection = await courseCollectionRef.where('code', '==',courseCode).get();

            if(courseCollection.empty) { throw new Error('Course does not exist'); }

            for (let doc of courseCollection.docs) {
                const courseRef = courseCollectionRef.doc(doc.id);
                const sectionCollectionRef = courseRef.collection('sections');

                const sectionCollection = await sectionCollectionRef.where('code', '==', section.code).get();

                if(!sectionCollection.empty) { throw new Error('Section already exist'); }

                await sectionCollectionRef.add(section);
            }
            
            return "Section created successfully";
        },
        deleteSection: async (_, { sectionCode, courseCode }, { uid, admin }) => {
            const store = admin.firestore();
            const userRef = store.collection('users').doc(uid);
            const userDoc = await userRef.get()

            if(!userDoc.exists) { throw new Error('User does not exist'); }

            const courseCollectionRef = userRef.collection('courses');
            const courseCollection = await courseCollectionRef.where('code', '==',courseCode).get();

            if(courseCollection.empty) { throw new Error('Course does not exist'); }

            for (let doc of courseCollection.docs) {
                const courseRef = courseCollectionRef.doc(doc.id);
                const sectionCollectionRef = courseRef.collection('sections');

                const sectionCollection = await sectionCollectionRef.where('code', '==', sectionCode).get();

                if(sectionCollection.empty) { throw new Error('Section does not exist'); }

                for (let doc of sectionCollection.docs) {
                    await deleteCollection(store,sectionCollectionRef.doc(doc.id).collection("taks"));
                    await sectionCollectionRef.doc(doc.id).delete();
                }
            }
            
            return "Section deleted successfully";
        },
        addSyllabus: async (_, {fileName, sectionCode, courseCode }, { uid, admin }) => {
            const store = admin.firestore();
            const userRef = store.collection('users').doc(uid);
            const userDoc = await userRef.get()

            if(!userDoc.exists) { throw new Error('User does not exist'); }

            const courseCollectionRef = userRef.collection('courses');
            const courseCollection = await courseCollectionRef.where('code', '==',courseCode).get();

            if(courseCollection.empty) { throw new Error('Course does not exist'); }

            for (let doc of courseCollection.docs) {
                const courseRef = courseCollectionRef.doc(doc.id);
                const sectionCollectionRef = courseRef.collection('sections');

                const sectionCollection = await sectionCollectionRef.where('code', '==', sectionCode).get();

                if(sectionCollection.empty) { throw new Error('Section does not exist'); }

                for (let doc of sectionCollection.docs) {
                    await sectionCollectionRef.doc(doc.id).update({ syllabus: fileName });
                }
            }

            return "Syllabus uploaded successfully";
        },
        deleteSyllabus: async (_, {file, sectionCode, courseCode }, { uid, admin }) => {
            const store = admin.firestore();
            const userRef = store.collection('users').doc(uid);
            const userDoc = await userRef.get()

            if(!userDoc.exists) { throw new Error('User does not exist'); }

            const courseCollectionRef = userRef.collection('courses');
            const courseCollection = await courseCollectionRef.where('code', '==',courseCode).get();

            if(courseCollection.empty) { throw new Error('Course does not exist'); }

            for (let doc of courseCollection.docs) {
                const courseRef = courseCollectionRef.doc(doc.id);
                const sectionCollectionRef = courseRef.collection('sections');

                const sectionCollection = await sectionCollectionRef.where('code', '==', sectionCode).get();

                if(sectionCollection.empty) { throw new Error('Section does not exist'); }

                for (let doc of sectionCollection.docs) {
                    await sectionCollectionRef.doc(doc.id).update({ syllabus: FieldValue.delete() });
                }
            }

            return "Syllabus deleted successfully";
        },
        addFiles: async (_, {files, sectionCode, courseCode }, { uid, admin }) => {
            const store = admin.firestore();
            const userRef = store.collection('users').doc(uid);
            const userDoc = await userRef.get()

            if(!userDoc.exists) { throw new Error('User does not exist'); }

            const courseCollectionRef = userRef.collection('courses');
            const courseCollection = await courseCollectionRef.where('code', '==',courseCode).get();

            if(courseCollection.empty) { throw new Error('Course does not exist'); }

            for (let doc of courseCollection.docs) {
                const courseRef = courseCollectionRef.doc(doc.id);
                const sectionCollectionRef = courseRef.collection('sections');

                const sectionCollection = await sectionCollectionRef.where('code', '==', sectionCode).get();

                if(sectionCollection.empty) { throw new Error('Section does not exist'); }

                for (let doc of sectionCollection.docs) {
                    await sectionCollectionRef.doc(doc.id).update({ files: FieldValue.arrayUnion(...files) });
                }
            }

            return "Files uploaded successfully";
        },
        deleteFiles: async (_, {files, sectionCode, courseCode }, {uid, admin }) => {
            const store = admin.firestore();
            const userRef = store.collection('users').doc(uid);
            const userDoc = await userRef.get()

            if(!userDoc.exists) { throw new Error('User does not exist'); }

            const courseCollectionRef = userRef.collection('courses');
            const courseCollection = await courseCollectionRef.where('code', '==',courseCode).get();

            if(courseCollection.empty) { throw new Error('Course does not exist'); }

            for (let doc of courseCollection.docs) {
                const courseRef = courseCollectionRef.doc(doc.id);
                const sectionCollectionRef = courseRef.collection('sections');

                const sectionCollection = await sectionCollectionRef.where('code', '==', sectionCode).get();

                if(sectionCollection.empty) { throw new Error('Section does not exist'); }

                for (let doc of sectionCollection.docs) {
                    await sectionCollectionRef.doc(doc.id).update({ files: FieldValue.arrayRemove(...files) });
                }
            }

            return "Files deleted successfully";
        },
        enroll: async (_, {instructorUsername, sectionCode, courseCode}, {uid, admin }) => {
            const store = admin.firestore();
            const instructorsCollectionRef = store.collection('users');
            const instructorsCollection = await instructorsCollectionRef.where('username', '==',instructorUsername).get();
            var instructorDoc;
            var courseDoc;
            var sectionDoc;

            if(instructorsCollection.empty) { throw new Error('Instructor does not exist'); }

            for (let doc of instructorsCollection.docs) {
                const instructorRef = instructorsCollectionRef.doc(doc.id);
                instructorDoc = await instructorRef.get()

                const courseCollectionRef = instructorRef.collection('courses');
                const courseCollection = await courseCollectionRef.where('code', '==',courseCode).get();

                if(courseCollection.empty) { throw new Error('Course does not exist'); }
                
                for (let doc of courseCollection.docs) {
                    const courseRef = courseCollectionRef.doc(doc.id);
                    courseDoc = await courseRef.get()

                    const sectionCollectionRef = courseRef.collection('sections');
                    const sectionCollection = await sectionCollectionRef.where('code', '==',sectionCode).get();

                    if(sectionCollection.empty) { throw new Error('Section does not exist'); }

                    for (let doc of sectionCollection.docs) { 
                        const sectionRef = sectionCollectionRef.doc(doc.id);
                        sectionDoc = await sectionRef.get()
                    }
                }
            }

            const studentRef = store.collection('users').doc(uid);
            const courseEnrolled = {
                instructor: instructorDoc.data(),
                course: courseDoc.data(),
                section: sectionDoc.data()
            } ;

            const response = await studentRef.update( 
                { 
                    enrolled: FieldValue.arrayUnion(courseEnrolled)
                }
            );

            if (!response) { throw new Error('Unable to enroll'); }

            return "Successful enrolled";
        },
        unenroll: async (_, {sectionCode}, {uid, admin }) => {
            const store = admin.firestore();
            const userRef = store.collection('users').doc(uid);
            const userDoc = await userRef.get();
            const user = userDoc.data();
            const enrolled = user.enrolled;

            if (!enrolled) { throw new Error('No sections enrolled'); }
            
            const section = enrolled.find(enroll => enroll.section.code === sectionCode);

            if (!section) { throw new Error('Section not found'); }

            await userRef.update({ enrolled: FieldValue.arrayRemove(section) });
            return "Unenrolled successfully";
        }
    }
};

const userVerification = async (store, uid) => {
    var result;
    const userRef = store.collection('users').doc(uid);
    const userDoc = await userRef.get();
    
    if(userDoc.exists) {
        result = userDoc.data();
    } else {
        throw new Error('User does not exist');
    }

    return result
};

const usernameVerification= async (store, username) => {
    if (username) {
        const userCollection = await store
        .collection('users')
        .where('username', '==', username)
        .get();

        if (!userCollection.empty) {
            throw new Error('Username already taken');
        }
    }
};

const deleteCollection = async (store, collectionRef) => {
    return new Promise((resolve, reject) => {
      deleteQueryBatch(store, collectionRef, resolve).catch(reject);
    });
  }
  
  async function deleteQueryBatch(store, collectionRef, resolve) {
    const snapshot = await collectionRef.get();
  
    const batchSize = snapshot.size;
    if (batchSize === 0) {
      // When there are no documents left, we are done
      resolve();
      return;
    }
  
    // Delete documents in a batch
    const batch = store.batch();
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    await batch.commit();
  
    // Recurse on the next process tick, to avoid
    // exploding the stack.
    process.nextTick(() => {
      deleteQueryBatch(store, collectionRef, resolve);
    });
  }

module.exports = {
    resolvers,
}