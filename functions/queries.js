const { gql } = require('apollo-server-express');

const queries = gql`

input NameInput {
    fName: String
    lName: String
}

input ProfileInput {
    username: String
    name: NameInput
}

input CourseInput {
    name: String!
    description: String!
    code: String!
}

input SectionInput {
    isActive: Boolean!
    code: String!
    schedule: [ScheduleInput]!
    maxStudents: Int!
}

input ScheduleInput {
        day: String!
        isActive: Boolean!
        classroom: String!
    }

type Query {
    instructors: [Instructor]
    instructorBy(username: String!): Instructor
    students(sectionCode: String!): [Student]
    instructor: Instructor
    student: Student
}

type Mutation {
    updateRole(role: Role!): String
    updateProfile(profile: ProfileInput!): String
    createCourse(course: CourseInput!): String
    deleteCourse(courseCode: String!): String
    addSection(section: SectionInput!, courseCode: String!): String
    deleteSection(sectionCode: String!, courseCode: String!): String
    addSyllabus(file: String!, sectionCode: String!, courseCode: String!): String
    deleteSyllabus(sectionCode: String!, courseCode: String!): String
    addFiles(files: [String]!, sectionCode: String!, courseCode: String!): String
    deleteFiles(files: [String]!, sectionCode: String!, courseCode: String!): String
    enroll(instructorUsername: String!, sectionCode: String!, courseCode: String!): String
    unenroll(sectionCode: String!): String
}
`;

module.exports = {
    queries,
};