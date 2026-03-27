import mongoose from "mongoose";
import UserStory from "../models/UserStory.model.js";
import Sprint from "../../Team_A/models/sprint.model.js";
import Project from "../../Team_A/models/project.model.js";

import Student from "../../Authentication/models/student.model.js";
import Task from "../../Team_C/models/task.model.js"
// 📌 CREATE USER STORY

export const createUserStory = async (data, studentId) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { title, description, priority, startDate, endDate, sprintId } = data;

    /** ----------------------------------------------------
     * 1. Validate that the student has a project
     * ---------------------------------------------------- */
    const student = await Student.findById(studentId).session(session);

    if (!student) {
      const error = new Error("Student not found");
      error.statusCode = 404;
      throw error;
    }


    if (!student.project) {
      const error = new Error("Student has no assigned project");
      error.statusCode = 400;
      throw error;
    }

    /** ---------------------------------------------
     * 2. Validate that sprint exists AND belongs to project
     * --------------------------------------------- */
    const sprint = await Sprint.findById(sprintId).session(session);

    if (!sprint || sprint.deletedAt) {
      const error = new Error("Sprint not found or deleted");
      error.statusCode = 404;
      throw error;
    }

    // Check sprint belongs to student's project
    if (String(sprint.projectId) !== String(student.project)) {
      const error = new Error("Sprint does not belong to your project");
      error.statusCode = 403;
      throw error;
    }

    /** --------------------
     * 3. Validate UserStory title doesn't exist in the sprint
     * -------------------- */
    const existingUserStory = await UserStory.findOne({
      title,
      sprintId,
      deletedAt: null
    }).session(session);

    if (existingUserStory) {
      const error = new Error("A user story with this name already exists in this sprint");
      error.statusCode = 409; // Conflict
      throw error;
    }

    /** --------------------
     * 4. Validate dates
     * -------------------- */
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (end <= start) {
      const error = new Error("End date must be after start date");
      error.statusCode = 400;
      throw error;
    }


    /** ----------------------------
     * 5. Create User Story
     * ---------------------------- */
    const newUserStory = new UserStory({
      title,
      description,
      priority,
      startDate: start,
      endDate: end,
      sprintId
    });

    const savedStory = await newUserStory.save({ session });

    /** --------------------------------------------
     * 6. Add UserStory reference to sprint
     * -------------------------------------------- */
    await Sprint.findByIdAndUpdate(
      sprintId,
      { $push: { userStories: savedStory._id } },
      { session }
    );

    await session.commitTransaction();

    return {
      success: true,
      message: "User story created successfully",
      data: {
        id: savedStory._id,
        title: savedStory.title,
        description: savedStory.description,
        priority: savedStory.priority,

        startDate: savedStory.startDate,
        endDate: savedStory.endDate,
        sprintId: savedStory.sprintId,
        createdAt: savedStory.createdAt
      }
    };

  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

// get User Stories for student's project
export const getUserStories = async (projectId) => {
  try {

    if (!projectId) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: "No project assigned to your account"
      });
    }

    // 1️⃣ Vérifier que le projet existe
    const project = await Project.findOne({ _id: projectId, deletedAt: null }).populate({
      path: 'sprints',
      match: { deletedAt: null }, // ignorer les sprints supprimés
      select: '_id title orderIndex'
    });

    if (!project) {
      return {
        success: false,
        message: "Project not found",
        data: []
      };
    }

    // 2️⃣ Récupérer tous les sprints du projet
    const sprintIds = project.sprints.map(s => s._id);

    if (sprintIds.length === 0) {
      return {
        success: true,
        message: "No sprints found for this project",
        data: []
      };
    }

    // 3️⃣ Récupérer toutes les UserStories liées à ces sprints
    const userStories = await UserStory.find({
      sprintId: { $in: sprintIds },
      deletedAt: null
    })
      .sort({ startDate: 1 });

    const formattedStories = userStories.map(story => {
      const { _id, tasks, __v, deletedAt, ...rest } = story.toObject ? story.toObject() : story;
      return { id: _id, ...rest };
    });

    return {
      success: true,
      message: "User stories retrieved successfully",
      data: formattedStories
    };
  } catch (error) {
    return {
      success: false,
      message: error.message,
      data: []
    };
  }
};

// get User Stories related to sprint
export const getUserStoriesRelatedToSprint = async (projectId, sprintId) => {
  /** 1️⃣ Vérifier que l'étudiant a un projet */
  if (!projectId) {
    const error = new Error("No project assigned to your account");
    error.statusCode = 404;
    throw error;
  }

  /** 2️⃣ Vérifier que le sprint existe */
  const sprint = await Sprint.findById(sprintId);

  if (!sprint || sprint.deletedAt) {
    const error = new Error("Sprint not found or deleted");
    error.statusCode = 404;
    throw error;
  }

  /** 3️⃣ Vérifier que le sprint appartient bien au projet */
  if (String(sprint.projectId) !== String(projectId)) {
    const error = new Error("Sprint does not belong to your project");
    error.statusCode = 403;
    throw error;
  }

  /** 4️⃣ Récupérer user stories avec deletedAt = null */
  const userStories = await UserStory.find({
    sprintId: sprintId,
    deletedAt: null
  })
    .select([
      "title",
      "description",
      "priority",
      "startDate",
      "endDate"
    ])
    .sort({ createdAt: 1 })
    .lean();

  return {
    success: true,
    message: "User stories retrieved successfully",
    data: {

      userStories: userStories.map(story => {
        const { _id, tasks, ...rest } = story;
        return { sprintId: sprint._id, id: _id, ...rest };
      })
    }
  };
};

// get US by ID
export const getUserStoryByID = async (userStoryId, projectId) => {
  /** 1️⃣ Vérifier que l'étudiant a un projet */
  if (!projectId) {
    const error = new Error("1️⃣ No project assigned to your account");
    error.statusCode = 404;
    throw error;
  }

  /** 2️⃣ Vérifier que la user story existe */
  const userStory = await UserStory.findOne({
    _id: userStoryId,
    deletedAt: null
  }).lean();

  if (!userStory) {
    const error = new Error("User Story not found or deleted");
    error.statusCode = 404;
    throw error;
  }

  /** 3️⃣ Vérifier que le sprint auquel elle appartient existe */
  const sprint = await Sprint.findById(userStory.sprintId).lean();
  if (!sprint || sprint.deletedAt) {
    const error = new Error("3️⃣ Sprint not found or deleted");
    error.statusCode = 404;
    throw error;
  }

  /** 4️⃣ Vérifier que le sprint appartient bien au projet de l'étudiant */
  if (String(sprint.projectId) !== String(projectId)) {
    const error = new Error(" 4️⃣ Sprint does not belong to your project");
    error.statusCode = 403;
    throw error;
  }

  /** 5️⃣ Tout est ok, retourner la user story avec les infos du sprint */
  const { _id, tasks, __v, deletedAt, ...rest } = userStory;

  return {
    success: true,
    message: "User Story retrieved successfully",
    data: { id: _id, ...rest }
  };
};


// UPDATE USER STORY 


export const updateUserStory = async (userStoryId, updateData, studentId) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      title,
      description,
      priority,
      startDate,
      endDate,
      sprintId
    } = updateData;

    /** ----------------------------------------------------
     * 1. Validate that the user story exists and not deleted
     * ---------------------------------------------------- */
    const userStory = await UserStory.findOne({
      _id: userStoryId,
      deletedAt: null
    }).session(session);

    if (!userStory) {
      const error = new Error("User story not found or deleted");
      error.statusCode = 404;
      throw error;
    }

    /** ----------------------------------------------------
     * 2. Validate that the student has a project
     * ---------------------------------------------------- */
    const student = await Student.findById(studentId).session(session);

    if (!student) {
      const error = new Error("Student not found");
      error.statusCode = 404;
      throw error;
    }

    if (!student.project) {
      const error = new Error("Student has no assigned project");
      error.statusCode = 400;
      throw error;
    }

    /** ----------------------------------------------------
     * 3. Validate that the user story belongs to student's project
     * ---------------------------------------------------- */
    const currentSprint = await Sprint.findOne({
      _id: userStory.sprintId,
      deletedAt: null
    }).session(session);

    if (!currentSprint) {
      const error = new Error("Current sprint not found");
      error.statusCode = 404;
      throw error;
    }

    if (String(currentSprint.projectId) !== String(student.project)) {
      const error = new Error("User story does not belong to your project");
      error.statusCode = 403;
      throw error;
    }

    /** ----------------------------------------------------
     * 4. If sprintId is being changed, validate new sprint
     * ---------------------------------------------------- */
    let newSprint = null;
    const isSprintChanging = sprintId && String(sprintId) !== String(userStory.sprintId);

    if (isSprintChanging) {
      newSprint = await Sprint.findOne({
        _id: sprintId,
        deletedAt: null
      }).session(session);

      if (!newSprint) {
        const error = new Error("New sprint not found or deleted");
        error.statusCode = 404;
        throw error;
      }

      // Validate new sprint belongs to the same project
      if (String(newSprint.projectId) !== String(student.project)) {
        const error = new Error("New sprint does not belong to your project");
        error.statusCode = 403;
        throw error;
      }
    }

    /** ----------------------------------------------------
     * 5. Validate title uniqueness (if title is being changed)
     * ---------------------------------------------------- */
    const finalTitle = title || userStory.title;
    const finalSprintId = sprintId || userStory.sprintId;

    // Check uniqueness only if title OR sprintId is changing
    if (
      (title && title !== userStory.title) ||
      isSprintChanging
    ) {
      const existingUserStory = await UserStory.findOne({
        _id: { $ne: userStoryId }, // Exclude current user story
        title: finalTitle,
        sprintId: finalSprintId,
        deletedAt: null
      }).session(session);

      if (existingUserStory) {
        const error = new Error(
          "A user story with this name already exists in this sprint"
        );
        error.statusCode = 409;
        throw error;
      }
    }

    /** ----------------------------------------------------
     * 6. Validate dates
     * ---------------------------------------------------- */
    const finalStartDate = startDate ? new Date(startDate) : userStory.startDate;
    const finalEndDate = endDate ? new Date(endDate) : userStory.endDate;

    if (finalEndDate <= finalStartDate) {
      const error = new Error("End date must be after start date");
      error.statusCode = 400;
      throw error;
    }

    /** ----------------------------------------------------
     * 7. Update user story
     * ---------------------------------------------------- */
    const updateFields = {};

    if (title !== undefined) updateFields.title = title;
    if (description !== undefined) updateFields.description = description;
    if (priority !== undefined) updateFields.priority = priority;

    if (startDate !== undefined) updateFields.startDate = finalStartDate;
    if (endDate !== undefined) updateFields.endDate = finalEndDate;
    if (sprintId !== undefined) updateFields.sprintId = sprintId;

    const updatedUserStory = await UserStory.findByIdAndUpdate(
      userStoryId,
      { $set: updateFields },
      { new: true, session, runValidators: true }
    );

    /** ----------------------------------------------------
     * 8. Update sprint references if sprint is changing
     * ---------------------------------------------------- */
    if (isSprintChanging) {
      // Remove from old sprint
      await Sprint.findByIdAndUpdate(
        userStory.sprintId,
        { $pull: { userStories: userStoryId } },
        { session }
      );

      // Add to new sprint
      await Sprint.findByIdAndUpdate(
        sprintId,
        { $push: { userStories: userStoryId } },
        { session }
      );
    }

    await session.commitTransaction();

    return {
      success: true,
      message: "User story updated successfully",
      data: {
        id: updatedUserStory._id,
        title: updatedUserStory.title,
        description: updatedUserStory.description,
        priority: updatedUserStory.priority,

        startDate: updatedUserStory.startDate,
        endDate: updatedUserStory.endDate,
        sprintId: updatedUserStory.sprintId,
        updatedAt: updatedUserStory.updatedAt
      }
    };

  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};


// DELETE USER STORY (soft delete) 

export const deleteUserStory = async (userStoryId, studentId) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    /** ----------------------------------------------------
     * 1. Validate that the user story exists and not deleted
     * ---------------------------------------------------- */
    const userStory = await UserStory.findOne({
      _id: userStoryId,
      deletedAt: null
    }).session(session);

    if (!userStory) {
      const error = new Error("User story not found or already deleted");
      error.statusCode = 404;
      throw error;
    }

    /** ----------------------------------------------------
     * 2. Validate that the student has a project
     * ---------------------------------------------------- */
    const student = await Student.findById(studentId).session(session);

    if (!student) {
      const error = new Error("Student not found");
      error.statusCode = 404;
      throw error;
    }

    if (!student.project) {
      const error = new Error("Student has no assigned project");
      error.statusCode = 400;
      throw error;
    }

    /** ----------------------------------------------------
     * 3. Validate that the user story belongs to student's project
     * ---------------------------------------------------- */
    const sprint = await Sprint.findOne({
      _id: userStory.sprintId,
      deletedAt: null
    }).session(session);

    if (!sprint) {
      const error = new Error("Sprint not found");
      error.statusCode = 404;
      throw error;
    }

    if (String(sprint.projectId) !== String(student.project)) {
      const error = new Error("User story does not belong to your project");
      error.statusCode = 403;
      throw error;
    }
    /** 4️⃣ Get all task IDs */
    const taskIds = userStory.tasks;

    /** 5️⃣ HARD DELETE tasks */
    const deletedTasksResult = await Task.deleteMany(
      { _id: { $in: taskIds } },
      { session }
    );

    /** 6️⃣ Remove task references from user story */
    await UserStory.findByIdAndUpdate(
      userStoryId,
      { $set: { tasks: [] } },   // ✅ nettoyage total
      { session }
    );


    /** ----------------------------------------------------
     * 5. Soft delete the user story
     * ---------------------------------------------------- */
    const deletedUserStory = await UserStory.findByIdAndUpdate(
      userStoryId,
      { $set: { deletedAt: new Date() } },
      { new: true, session }
    );

    /** ----------------------------------------------------
     * 6. Remove user story reference from sprint
     * ---------------------------------------------------- */
    await Sprint.findByIdAndUpdate(
      userStory.sprintId,
      { $pull: { userStories: userStoryId } },
      { session }
    );

    await session.commitTransaction();

    return {
      success: true,
      message: "User story and associated tasks deleted successfully",
      data: {
        id: deletedUserStory._id,
        title: deletedUserStory.title,
        deletedTasksCount: deletedTasksResult.modifiedCount,
        deletedAt: deletedUserStory.deletedAt
      }
    };

  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};