const { gql } = require('apollo-server-express');

const schema = gql`
    enum Role {
        STUDENT
        INSTRUCTOR
        ADMIN
    }

    type Name {
        fName: String!
        lName: String!
    }

    interface BUser {
        username: String
        email: String!
        isEmailVerified: Boolean!
        creationDate: Float!
        role: Role
        name: Name
    }

    type Student implements BUser {
        username: String
        email: String!
        isEmailVerified: Boolean!
        creationDate: Float!
        role: Role
        name: Name

        sections: [Section!]
        enrolled: [EnrolledSection!]
    }

    type Instructor implements BUser {
        username: String
        email: String!
        isEmailVerified: Boolean!
        creationDate: Float!
        role: Role
        name: Name

        courses: [Course!]
    }

    type Course {
        name: String!
        description: String!
        code: String!
        sections: [Section!]
    }

    type Section {
        isActive: Boolean!
        code: String!
        schedule: [Schedule!]!
        maxStudents: Int!
        syllabus: String
        tasks: [Task!]
        files: [String!]
        grader: [Grade!]
        students: [Student!]
    }

    type EnrolledSection {
        instructor: Instructor!
        course: Course!
        section: Section!
    }

    type Schedule {
        day: String!
        isActive: Boolean!
        classroom: String!
    }

    interface Task {
        name: String!
        maxScore: Int!
        isHidden: Boolean!
    }

    type Grade {
        task: Task!
        staudent: BUser!
        score: Int!
    }

    enum PoolType {
        MULATIPLE_CHOICE
        TRUE_FALSE
    }

    type Pool implements Task {
        name: String!
        maxScore: Int!
        isHidden: Boolean!

        type: PoolType
        questions: [Question!]!
    }

    type Question {
        description: String!
        answers: [Answer!]!
    }

    type Answer {
        description: String!
        isCorrect: Boolean!
    }

    #############################

    

    type Quiz implements Task {
        name: String!
        maxScore: Int!
        isHidden: Boolean!

        questions: [Question!]!
    }

    type Exam implements Task {
        name: String!
        maxScore: Int!
        isHidden: Boolean!

        questions: [Question!]
        file: String
    }

    type Assignment implements Task {
        name: String!
        maxScore: Int!
        isHidden: Boolean!

        file: String
    }



`

module.exports = {
    schema,
};