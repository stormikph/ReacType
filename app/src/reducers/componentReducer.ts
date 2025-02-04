import React from 'react';
import {
  State,
  Action,
  Component,
  ChildElement,
  HTMLType
} from '../interfaces/Interfaces';
import initialState from '../context/initialState';
import generateCode from '../helperFunctions/generateCode';
import cloneDeep from '../helperFunctions/cloneDeep';
import { isValueObject } from 'immutable';
import Canvas from '../components/main/Canvas';

const reducer = (state: State, action: Action) => {
  // if the project type is set as Next.js, next component code should be generated
  // otherwise generate classic react code

  // find top-level component given a component id
  const findComponent = (components: Component[], componentId: number) => {
    return components.find(elem => elem.id === componentId);
  };

  // Finds a parent
  // returns object with parent object and index value of child
  const findParent = (component: Component, childId: number) => {
    // using a breadth first search to search through instance tree
    // We're going to keep track of the nodes we need to search through with an Array
    //  Initialize this array with the top level node
    const nodeArr: (Component | ChildElement)[] = [component];
    // iterate through each node in the array as long as there are elements in the array
    while (nodeArr.length > 0) {
      // shift off the first value and assign to an element
      const currentNode = nodeArr.shift();
      // try to find id of childNode in children
      for (let i = 0; i <= currentNode.children.length - 1; i++) {
        // if match is found return object with both the parent and the index value of the child
        if (currentNode.children[i].childId === childId) {
          return { directParent: currentNode, childIndexValue: i };
        }
      }
      // if child node isn't found add each of the current node's children to the search array
      currentNode.children.forEach((node: ChildElement) => nodeArr.push(node));
    }
    // if no search is found return -1
    return { directParent: null, childIndexValue: null };
  };

  const deleteChild = (component: Component, currentChildId: number) => {
    const { directParent, childIndexValue } = findParent(
      component,
      currentChildId
    );
    directParent.children.splice(childIndexValue, 1);
  };

  // determine if there's child of a given type in a component
  const childTypeExists = (
    type: string,
    typeId: number,
    component: Component
  ) => {
    const nodeArr = [...component.children];
    // breadth first search through component tree to see if a child exists
    while (nodeArr.length > 0) {
      // shift off the first value and assign to an element
      const currentNode = nodeArr.shift();
      if (currentNode.type === type && currentNode.typeId === typeId)
        return true;
      // if child node isn't found add each of the current node's children to the search array
      currentNode.children.forEach(node => nodeArr.push(node));
    }
    // if no match is found return false
    return false;
  };

  // find child in component and return child object
  const findChild = (component: Component, childId: number) => {
    if (childId === null) return component;
    const nodeArr = [...component.children];
    // breadth first search through component tree to see if a child exists
    while (nodeArr.length > 0) {
      // shift off the first value and assign to an element
      const currentNode = nodeArr.shift();
      if (currentNode.childId === childId) return currentNode;
      // if child node isn't found add each of the current node's children to the search array
      currentNode.children.forEach(node => nodeArr.push(node));
    }
    // if no match is found return false
    return;
  };

  // update all ids and typeIds to match one another
  const updateAllIds = (comp: Component[] | ChildElement[]) => {
    // put components' names and ids into an obj
    const obj = {};
    comp.forEach(el => {
      obj[el.name] = el.id;
    });
    // for each of the components, if it has children, iterate through that children array
    comp.forEach(el => {
      if (el.children.length > 0) {
        for (let i = 0; i < el.children.length; i++) {
          // update each child's childId
          el.children[i].childId = i + 1;
          // if the child's name and id exists in the object
          if (obj[el.children[i].name]) {
            // set the child's typeId to be the value in the object of the child's name key
            el.children[i].typeId = obj[el.children[i].name];
          }
          // recursively call the updateAllIds function on the child's children array if
          // the child's children array is greater than 0
          if (el.children[i].children.length > 0) {
            updateAllIds(el.children[i].children);
          }
        }
      }
    });
  };

  const updateIds = (components: Component[]) => {
    // component IDs should be array index + 1
    components.forEach((comp, i) => (comp.id = i + 1));

    updateAllIds(components);

    // create KV pairs of component names and corresponding IDs
    const componentIds = {};
    components.forEach(component => {
      if (!component.isPage) componentIds[component.name] = component.id;
    });

    // assign correct ID to components that are children inside of remaining pages
    components.forEach(page => {
      if (page.isPage) {
        page.children.forEach(child => {
          if (child.type === 'Component')
            child.typeId = componentIds[child.name];
        });
      }
    });
    return components;
  };

  const updateRoots = (components: Component[]) => {
    const roots = [];
    // for each of the components in the passed in array of components, if the child component
    // is a page, push its id into the roots array
    components.forEach(comp => {
      if (comp.isPage) roots.push(comp.id);
    });
    return roots;
  };

  const deleteById = (id: number, name: string): Component[] => {
    // name of the component we want to delete

    const checkChildren = (child: Component[] | ChildElement[]) => {
      // for each of the components in the passed in components array, if the child
      // component has a children array, iterate through the array of children
      child.forEach(el => {
        if (el.children.length) {
          const arr = [];
          for (let i = 0; i < el.children.length; i++) {
            // check to see if the name variable doesn't match the name of the child
            if (el.children[i].name !== name) {
              // if so, push into the new array the child component
              arr.push(el.children[i]);
            }
          }
          // set the children array to be the new array
          el.children = arr;
          // recursively call the checkChildren function with the updated children array
          checkChildren(el.children);
        }
      });
    };
    // creating a copy of the components array
    const copyComp = [...state.components];

    if (copyComp.length) {
      checkChildren(copyComp);
    }

    const filteredArr = [...copyComp].filter(comp => comp.id != id);
    return updateIds(filteredArr);
  };

  const convertToJSX = arrayOfElements => {
    // if id exists in state.HTMLTypes
    for (let i = 0; i < initialState.HTMLTypes.length; i += 1) {
      arrayOfElements[i] = initialState.HTMLTypes[i];
    }
  };

  const deleteComponentFromPages = (components, name) => {
    const searchNestedComps = childComponents => {
      // if (childComponents.length === 0) return console.log('empty children array');
      // childComponents.forEach((comp, i, arr) => {
      //   console.log('each individual comp', comp);
      //   if (comp.name === name){
      //     arr.splice(i, 1);
      //   } else searchNestedComps(childComponents.children)
      // });
    };
    components.forEach(comp => {
      searchNestedComps(comp.children);
    });
  };

  switch (action.type) {
    case 'ADD COMPONENT': {
      if (
        typeof action.payload.componentName !== 'string' ||
        action.payload.componentName === ''
      )
        return state;

      const components = [...state.components];
      const newComponent = {
        id: state.components.length + 1,
        name: action.payload.componentName,
        nextChildId: 1,
        style: {},
        code: '',
        children: [],
        isPage: action.payload.root
      };
      components.push(newComponent);

      const rootComponents = [...state.rootComponents];
      if (action.payload.root) rootComponents.push(newComponent.id);

      // update the focus to the new component
      const canvasFocus = {
        ...state.canvasFocus,
        componentId: newComponent.id,
        childId: null
      };

      const nextComponentId = state.nextComponentId + 1;
      return {
        ...state,
        components,
        rootComponents,
        nextComponentId,
        canvasFocus
      };
    }
    // Add child to a given root component
    case 'ADD CHILD': {
      const {
        type,
        typeId,
        childId
      }: { type: string; typeId: number; childId: any } = action.payload;

      const parentComponentId: number = state.canvasFocus.componentId;
      const components = [...state.components];
      updateAllIds(components);

      // find component that we're adding a child to
      const parentComponent = findComponent(components, parentComponentId);

      let componentName = '';
      let componentChildren = [];

      if (type === 'Component') {
        components.forEach(comp => {
          if (comp.id === typeId) {
            componentName = comp.name;
            componentChildren = comp.children;
          }
        });
      }

      if (type === 'Component') {
        const originalComponent = findComponent(state.components, typeId);
        if (childTypeExists('Component', parentComponentId, originalComponent))
          return state;
      }

      let newName = state.HTMLTypes.reduce((name, el) => {
        if (typeId === el.id) {
          name = type === 'Component' ? componentName : el.tag;
        }
        return name;
      }, '');

      if (type === 'Route Link') {
        components.find(comp => {
          if (comp.id === typeId) {
            newName = comp.name;
            return;
          }
        });
      }
      const newChild: ChildElement = {
        type,
        typeId,
        name: newName,
        childId: state.nextChildId,
        style: {},
        children: componentChildren
      };

      // if the childId is null, this signifies that we are adding a child to the top level component rather than another child element

      if (childId === null) {
        parentComponent.children.push(newChild);
      }
      // if there is a childId (childId here references the direct parent of the new child) find that child and a new child to its children array
      else {
        const directParent = findChild(parentComponent, childId);
        directParent.children.push(newChild);
      }

      parentComponent.code = generateCode(
        components,
        parentComponentId,
        [...state.rootComponents],
        state.projectType,
        state.HTMLTypes
      );

      const canvasFocus = {
        ...state.canvasFocus,
        componentId: state.canvasFocus.componentId,
        childId: newChild.childId
      };

      let nextChildId: number = 1;
      for (let i = 0; i < parentComponent.children.length; i+=1) {
        nextChildId +=1;
      }
      return { ...state, components, nextChildId, canvasFocus };
    }
    // move an instance from one position in a component to another position in a component
    case 'CHANGE POSITION': {
      const { currentChildId, newParentChildId } = action.payload;

      // if the currentChild Id is the same as the newParentId (i.e. a component is trying to drop itself into itself), don't update sate
      if (currentChildId === newParentChildId) return state;

      // find the current component in focus
      const components = [...state.components];
      const component = findComponent(
        components,
        state.canvasFocus.componentId
      );

      // find the moved element's former parent
      // delete the element from it's former parent's children array
      const { directParent, childIndexValue } = findParent(
        component,
        currentChildId
      );
      const child = { ...directParent.children[childIndexValue] };
      directParent.children.splice(childIndexValue, 1);

      // if the childId is null, this signifies that we are adding a child to the top level component rather than another child element
      if (newParentChildId === null) {
        component.children.push(child);
      }
      // if there is a childId (childId here references the direct parent of the new child) find that child and a new child to its children array
      else {
        const directParent = findChild(component, newParentChildId);
        directParent.children.push(child);
      }

      component.code = generateCode(
        components,
        state.canvasFocus.componentId,
        [...state.rootComponents],
        state.projectType,
        state.HTMLTypes
      );

      let nextChildId: number = 1;
      for (let i = 0; i < component.children.length; i+=1) {
        nextChildId +=1;
      }
      updateAllIds(components);
      return { ...state, components, nextChildId };
    }
    // Change the focus component and child
    case 'CHANGE FOCUS': {
      const {
        componentId,
        childId
      }: { componentId: number; childId: number | null } = action.payload;
      const canvasFocus = { componentId, childId };
      const components = [...state.components];
      updateAllIds(components);
      return { ...state, canvasFocus, components };
    }
    case 'UPDATE CSS': {
      const { style } = action.payload;
      const components = [...state.components];

      const component = findComponent(
        components,
        state.canvasFocus.componentId
      );
      const targetChild = findChild(component, state.canvasFocus.childId);
      targetChild.style = style;

      component.code = generateCode(
        components,
        state.canvasFocus.componentId,
        [...state.rootComponents],
        state.projectType,
        state.HTMLTypes
      );

      return { ...state, components };
    }
    case 'DELETE CHILD': {
      // if in-focus instance is a top-level component and not a child, don't delete anything

      // if (!state.canvasFocus.childId) return state;

      // find the current component in focus
      const components = [...state.components];
      const component = findComponent(
        components,
        state.canvasFocus.componentId
      );
      // find the moved element's former parent
      // delete the element from its former parent's children array
      const { directParent, childIndexValue } = findParent(
        component,
        state.canvasFocus.childId
      );
      const child = { ...directParent.children[childIndexValue] };
      directParent.children.splice(childIndexValue, 1);

      component.code = generateCode(
        components,
        state.canvasFocus.componentId,
        [...state.rootComponents],
        state.projectType,
        state.HTMLTypes
      );

      let nextChildId: number = 1;
      for (let i = 0; i < component.children.length; i+=1) {
        nextChildId +=1;
      }

      let childId: null | number = ((state.canvasFocus.childId - 1) === 0) ? null : state.canvasFocus.childId - 1;
      const canvasFocus = { ...state.canvasFocus, childId };
      updateAllIds(components);
      return { ...state, components, canvasFocus, nextChildId };
    }

    case 'DELETE PAGE': {
      const id: number = state.canvasFocus.componentId;
      const name: string = state.components[id - 1].name;

      const components: Component[] = deleteById(id, name);

      // rebuild rootComponents with correct page IDs
      const rootComponents = updateRoots(components);
      const canvasFocus = { componentId: 1, childId: null };
      return { ...state, rootComponents, components, canvasFocus };
    }
    case 'DELETE REUSABLE COMPONENT': {
      const id: number = state.canvasFocus.componentId;
      const name: string = state.components[id - 1].name;

      // updated list of components after deleting a component
      const components: Component[] = deleteById(id, name);
      const rootComponents: number[] = updateRoots(components);

      // iterate over the length of the components array
      components.forEach((el, i) => {
        // for each components' code, run the generateCode function to
        // update the code preview on the app
        el.code = generateCode(
          components,
          components[i].id,
          rootComponents,
          state.projectType,
          state.HTMLTypes
        );
      }


      const canvasFocus = { componentId: 1, childId: null };

      return {
        ...state,
        rootComponents,
        components,
        canvasFocus,
        nextComponentId: id
      };
    }

    case 'SET INITIAL STATE': {
      // set the canvas focus to be the first component
      const canvasFocus = {
        ...action.payload.canvasFocus,
        componentId: 1,
        childId: null
      };

      convertToJSX(action.payload.HTMLTypes);

      return { ...action.payload, canvasFocus };
    }
    case 'SET PROJECT NAME': {
      return {
        ...state,
        name: action.payload
      };
    }
    case 'CHANGE PROJECT TYPE': {
      // when a project type is changed, both change the project type in state and also regenerate the code for each component
      const { projectType } = action.payload;

      const components = [...state.components];
      components.forEach(component => {
        component.code = generateCode(
          components,
          component.id,
          [...state.rootComponents],
          projectType,
          state.HTMLTypes
        );
      });

      // also update the name of the root component of the application to fit classic React and next.js conventions
      if (projectType === 'Next.js') components[0]['name'] = 'index';
      else components[0]['name'] = 'App';

      return { ...state, components, projectType };
    }
    // Reset all component data back to their initial state but maintain the user's project name and log-in status
    case 'RESET STATE': {
      const nextChildId = 1;
      const rootComponents = [1];
      const nextComponentId = 2;
      const canvasFocus = {
        ...state.canvasFocus,
        componentId: 1,
        childId: null
      };
      const rootComponent = {
        ...state.components[0],
        code: '<div>Drag in a component or HTML element into the canvas!</div>',
        children: [],
        style: {}
      };
      const components = [rootComponent];
      return {
        ...state,
        nextChildId,
        rootComponents,
        nextComponentId,
        components,
        canvasFocus
      };
    }

    case 'UPDATE PROJECT NAME': {
      const projectName = action.payload;
      return {
        ...state,
        name: projectName
      };
    }

    case 'OPEN PROJECT': {
      convertToJSX(action.payload.HTMLTypes);
      // action.payload.canvasFocus = { ...action.payload.canvasFocus, childId: null}
      return {
        ...action.payload
      };
    }

    case 'ADD ELEMENT': {
      const HTMLTypes: HTMLType[] = [...state.HTMLTypes];
      HTMLTypes.push(action.payload);
      return {
        ...state,
        HTMLTypes
      };
    }

    case 'DELETE ELEMENT': {
      let name: string = '';
      const HTMLTypes: HTMLType[] = [...state.HTMLTypes].filter(el => {
        if (el.id === action.payload) {
          name = el.tag;
        }
        return el.id !== action.payload;
      });
      const components: Component[] = deleteById(action.payload, name);
      const rootComponents: number[] = updateRoots(components);
      components.forEach((el, i) => {
        el.code = generateCode(
          components,
          components[i].id,
          rootComponents,
          state.projectType,
          state.HTMLTypes
        );
      })
      return {
        ...state,
        HTMLTypes,
        components
      };
    }

    default:
      return state;
  }
};

export default reducer;
