import Task from "../models/task.model.js"
import Project from "../../Team_A/models/project.model.js"
import CompSupervisor from "../../Authentication/models/compSupervisor.model.js"
import UnivSupervisor from "../../Authentication/models/uniSupervisor.model.js"
import UserStory from "../../Team_B/models/UserStory.model.js"
import TaskValidator from "../models/taskValidator.model.js"
import TaskHistory from "../models/taskHistory.model.js"
import Sprint from "../../Team_A/models/sprint.model.js"

const NO_VALIDATION_REQUEST = "none";
const PENDING_VALIDATION_REQUEST = "in progress";

const getLatestTaskValidationStatusMap = async (taskIds) => {
  if (!taskIds.length) {
    return new Map();
  }
  // fetch validators and include identifying fields so frontend can find the validation id
  const validators = await TaskValidator.find({
    taskId: { $in: taskIds },
  })
    .sort({ createdAt: -1 })
    .select("taskId validatorStatus taskStatus validatorId comment createdAt");

  const latestValidationByTask = new Map();
  for (const validator of validators) {
    const key = validator.taskId.toString();
    if (!latestValidationByTask.has(key)) {
      // store the full validator document (as plain object) for downstream use
      latestValidationByTask.set(key, validator.toObject());
    }
  }

  return latestValidationByTask;
};

const attachValidationStatusToTask = (task, validationStatusMap) => {
  const taskObject = task.toObject();
  const { _id, __v, ...rest } = taskObject;

  const validatorObj = validationStatusMap.get(_id.toString()) || null;
  const taskValidationStatus = validatorObj?.validatorStatus || NO_VALIDATION_REQUEST;
  const isWaitingValidation = taskValidationStatus === PENDING_VALIDATION_REQUEST;
  const isValidated = taskValidationStatus === "valid" || taskValidationStatus === NO_VALIDATION_REQUEST;

  return {
    id: _id,
    ...rest,
    taskValidationStatus,
    isWaitingValidation,
    isValidated,
    // expose the last validation object so frontend can find the validation id and requested status
    lastValidation: validatorObj,
    taskValidationId: validatorObj?._id || null,
  };
};

async function verifyUserStoryExists(userStoryId) {
  const userStory = await UserStory.findById(userStoryId);
  if (!userStory) {
    const error = new Error("User story not found.");
    error.status = 404;
    throw error;
  }
  return true;
}

export const createTask = async (data) => {
  const { title, userStoryId } = data;
  if (!title || !userStoryId) {
    const error = new Error("Title and userStoryId are required.");
    error.status = 400;
    throw error;
  }

  await verifyUserStoryExists(userStoryId);

  const existing = await Task.findOne({ title, userStoryId });
  if (existing) {
    const error = new Error("Task with this title already exists for this user story.");
    error.status = 409;
    throw error;
  }

  const newTask = await Task.create(data);

  // Add the created task to the UserStory's tasks array
  await UserStory.findByIdAndUpdate(userStoryId, {
    $push: { tasks: newTask._id }
  });

  const taskObj = newTask.toObject();
  const { _id, __v, ...rest } = taskObj;
  return { id: _id, ...rest };
};

//function that allows the supervisor to extract all the tasks he is envolved with 
export const getAllTasksForCompSupvisor = async (compSupervisorId) => {
  const compSupervisor = await CompSupervisor.findById(compSupervisorId).populate('studentsId');
  if (!compSupervisor) {
    const error = new Error("Company supervisor not found.");
    error.status = 404;
    throw error;
  }

  const studentIds = compSupervisor.studentsId.map(student => student._id);
  const projects = await Project.find({ contributors: { $in: studentIds } }).populate('sprints');
  const sprintIds = projects.flatMap(project => project.sprints.map(sprint => sprint._id));
  const userStories = await UserStory.find({ sprintId: { $in: sprintIds } });
  const userStoryIds = userStories.map(userStory => userStory._id);
  const tasks = await Task.find({ userStoryId: { $in: userStoryIds } });

  const validationStatusMap = await getLatestTaskValidationStatusMap(tasks.map(task => task._id));
  const enrichedTasks = tasks.map(task => attachValidationStatusToTask(task, validationStatusMap));

  return { message: "Tasks retrieved successfully", tasks: enrichedTasks };
};
//function that allows the university supervisor to extract all the tasks he is envolved with 
export const getAllTasksForUnivSupervisor = async (userId) => {
  const univSupervisor = await UnivSupervisor.findOne({ userId }).populate('studentsId');
  if (!univSupervisor) {
    const error = new Error("University supervisor not found.");
    error.status = 404;
    throw error;
  }

  const studentIds = univSupervisor.studentsId.map(student => student._id);
  // Fetch all projects that include these students
  const projects = await Project.find({ contributors: { $in: studentIds } }).populate('sprints');
  const sprintIds = projects.flatMap(project => project.sprints.map(sprint => sprint._id));
  // Fetch all user stories that belong to these sprints
  const userStories = await UserStory.find({ sprintId: { $in: sprintIds } });
  const userStoryIds = userStories.map(userStory => userStory._id);

  // Fetch all tasks that belong to these user stories
  const tasks = await Task.find({ userStoryId: { $in: userStoryIds } });

  const validationStatusMap = await getLatestTaskValidationStatusMap(tasks.map(task => task._id));
  const enrichedTasks = tasks.map(task => attachValidationStatusToTask(task, validationStatusMap));

  return { message: "Tasks retrieved successfully", tasks: enrichedTasks };
};



export const getTaskById = async (id) => {
  const task = await Task.findById(id);
  if (!task) {
    const error = new Error("Task not found.");
    error.status = 404;
    throw error;
  }
  const validationStatusMap = await getLatestTaskValidationStatusMap([task._id]);
  const enrichedTask = attachValidationStatusToTask(task, validationStatusMap);

  return { message: "Task retrieved successfully", task: enrichedTask };
};


/*export const updateTask = async (id, data) => {
  const task = await Task.findByIdAndUpdate(id, data, { new: true });
  if (!task) {
    const error = new Error("Task not found.");
    error.status = 404;
    throw error;
  }
  return { message: "Task updated successfully", task };
};
*/
export const deleteTask = async (id) => {
  const task = await Task.findByIdAndDelete(id);
  if (!task) {
    const error = new Error("Task not found.");
    error.status = 404;
    throw error;
  }
  // Delete all associated TaskValidator entries
  await TaskValidator.deleteMany({ task_id: id });

  // Remove the task from its associated UserStory's tasks array
  await UserStory.findByIdAndUpdate(task.userStoryId, {
    $pull: { tasks: id }
  });

  const { _id, __v, ...rest } = task.toObject();
  return { message: "Task deleted successfully", task: { id: _id, ...rest } };
};


// make a function that retreive all the tasks for a specific user story by it ID 
export const getAllTasksForUserStory = async (userStoryId) => {
  const tasks = await Task.find({ userStoryId });
  if (!tasks.length) {
    //if there is no tasks for the userstory return empty list tasks
    return [];
  }

  const validationStatusMap = await getLatestTaskValidationStatusMap(tasks.map(task => task._id));
  return tasks.map(task => attachValidationStatusToTask(task, validationStatusMap));
};

//function that allows the student to update the status of the task to ["todo", "in+progress", "standby", "done"] and put it inside the taskvalidator model  
export const updateTaskStatus = async (id, data) => {
  const task = await Task.findById(id);
  if (!task) {
    const error = new Error("Task not found.");
    error.status = 404;
    throw error;
  }
  if (task.status === data.status) {
    const error = new Error("Task is already in this status.");
    error.status = 400;
    throw error;
  }
  const taskValidator = await TaskValidator.create({
    taskId: id,
    taskStatus: data.status, // This is the proposed new status
    validatorId: data.validatorId,
    comment: data.comment,
    meetingType: data.meetingType
  });

  return { message: "Task status validation request created successfully", taskValidator };
};

//function that allows the supervisor to validate the status of the task
export const validateTaskStatus = async (id, data) => {
  const taskValidator = await TaskValidator.findById(id);
  if (!taskValidator) {
    const error = new Error("Task validator not found.");
    error.status = 404;
    throw error;
  }
  const task = await Task.findById(taskValidator.taskId);
  if (!task) {
    const error = new Error("Task not found.");
    error.status = 404;
    throw error;
  }
  // allow caller to provide the validatorId (supervisor id) so history records the correct user
  if (data?.validatorId) {
    try {
      taskValidator.validatorId = data.validatorId;
    } catch (e) {
      // ignore if invalid id
    }
  }

  if (data.validatorStatus === "valid") {
    const oldStatus = task.status;
    task.status = taskValidator.taskStatus;
    await task.save();

    await TaskHistory.create({
      taskId: task._id,
      modifiedBy: taskValidator.validatorId,
      oldValue: { status: oldStatus },
      newValue: { status: taskValidator.taskStatus },
      fieldChanged: "status"
    });

    await TaskValidator.findByIdAndDelete(id);
    return { message: "Task status updated and validated successfully", task };
  } else {
    taskValidator.validatorStatus = data.validatorStatus;
    await taskValidator.save();
    return { message: "Task validation request updated", taskValidator };
  }
};

//Function that makes a full report about the project in a json file as follow -> Project -> Userstories -> Sprints -> Tasks
//Function that makes a full report about the project in a json file as follow -> Project -> Userstories -> Sprints -> Tasks
export const makeFullReport = async (projectId) => {
  const project = await Project.findById(projectId).populate('sprints');
  if (!project) {
    const error = new Error("Project not found.");
    error.status = 404;
    throw error;
  }

  // Fetch sprints associated with the project
  const sprints = await Sprint.find({ projectId: projectId });
  const sprintIds = sprints.map(sprint => sprint._id);

  // Fetch user stories associated with these sprints
  const userStories = await UserStory.find({ sprintId: { $in: sprintIds } });
  const userStoryIds = userStories.map(us => us._id);

  // Fetch tasks associated with these user stories
  const tasks = await Task.find({ userStoryId: { $in: userStoryIds } });
  const validationStatusMap = await getLatestTaskValidationStatusMap(tasks.map(task => task._id));

  const report = {
    project: {
      title: project.title,
      description: project.description,
      startDate: project.startDate,
      endDate: project.endDate,
    },
    sprints: sprints.map(sprint => ({
      name: sprint.title, // Assuming sprintName based on typical naming, verify Sprint model if needed
      startDate: sprint.startDate,
      endDate: sprint.endDate,
    })),
    userStories: userStories.map(userStory => ({
      title: userStory.title,
      description: userStory.description,
      priority: userStory.priority,

      startDate: userStory.startDate,
      endDate: userStory.endDate,
    })),
    tasks: tasks.map(task => {
      const enrichedTask = attachValidationStatusToTask(task, validationStatusMap);
      return {
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        taskValidationStatus: enrichedTask.taskValidationStatus,
        isWaitingValidation: enrichedTask.isWaitingValidation,
        isValidated: enrichedTask.isValidated,
      };
    }),
  };
  return report;
};

//function that make get a global report for a sprint , same thing as the project report but for a sprint
export const makeSprintReport = async (sprintId) => {
  const sprint = await Sprint.findById(sprintId).populate('userStories');
  if (!sprint) {
    const error = new Error("Sprint not found.");
    error.status = 404;
    throw error;
  }

  // Fetch user stories associated with the sprint
  const userStories = await UserStory.find({ sprintId: sprintId });
  const userStoryIds = userStories.map(us => us._id);

  // Fetch tasks associated with these user stories
  const tasks = await Task.find({ userStoryId: { $in: userStoryIds } });
  const validationStatusMap = await getLatestTaskValidationStatusMap(tasks.map(task => task._id));

  const report = {
    sprint: {
      title: sprint.title,
      startDate: sprint.startDate,
      endDate: sprint.endDate,
    },
    userStories: userStories.map(userStory => ({
      title: userStory.title,
      description: userStory.description,
      priority: userStory.priority,

      startDate: userStory.startDate,
      endDate: userStory.endDate,
    })),
    tasks: tasks.map(task => {
      const enrichedTask = attachValidationStatusToTask(task, validationStatusMap);
      return {
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        taskValidationStatus: enrichedTask.taskValidationStatus,
        isWaitingValidation: enrichedTask.isWaitingValidation,
        isValidated: enrichedTask.isValidated,
      };
    }),
  };
  return report;
};

//function that retreive all the tasks for the students in a project (only the tasks)
//project id is not needed because each student has one project
export const getAllTasksForProject = async (projectId) => {
  const sprints = await Sprint.find({ projectId: projectId });
  const userStories = await UserStory.find({ sprintId: { $in: sprints.map(sprint => sprint._id) } });
  const tasks = await Task.find({ userStoryId: { $in: userStories.map(userStory => userStory._id) } });

  const validationStatusMap = await getLatestTaskValidationStatusMap(tasks.map(task => task._id));
  return tasks.map(task => attachValidationStatusToTask(task, validationStatusMap));
}