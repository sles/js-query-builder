// Query Builder

const QueryBuilderFactory = (function () {
  class QueryBuilder {
    constructor(initialTree, updateCallback) {
      this.identityManager = new IdentityManager();
      this.updateCallback = updateCallback;

      this.createNode = this.createNode.bind(this);
      this.withUpdate = this.withUpdate.bind(this);

      this.addNode    = this.withUpdate(this.addNode.bind(this));
      this.createTree = this.withUpdate(this.createTree.bind(this));
      this.removeNode = this.withUpdate(this.removeNode.bind(this));
      this.modifyNode = this.withUpdate(this.modifyNode.bind(this));

      this.createTree(initialTree);
    }

    addNode(parentId, entity) {
      for (let node of this.tree) {
        if (node.id === parentId && !!node.rules) {
          const newNode = this.createNode(entity);

          node.rules.push(newNode);
          break;
        }
      }
    }

    checkNode(node, nodeEntity) {
      const nodeFields = Object.keys(node);
      let isValid = true;

      if (nodeEntity === 'group') {
        isValid = !!(~nodeFields.indexOf('rules') && ~nodeFields.indexOf('combinator'));
      } else {
        isValid = !!(~nodeFields.indexOf('field') && ~nodeFields.indexOf('value') && ~nodeFields.indexOf('operator'));
      }

      return isValid;
    }

    copyTree(tree) {
      return JSON.parse(JSON.stringify(tree));
    }

    createNode(entity) {
      const newNode = {};

      if (entity === 'group') {
        newNode.rules = [];
        newNode.combinator = 'AND';
      } else {
        newNode.field = '';
        newNode.value = '';
        newNode.operator = '';
      }

      newNode.id = this.identityManager.getId(entity);

      return newNode;
    }

    createTree(initialTree = null) {
      let newTree;

      try {
        newTree = initialTree;
        newTree[Symbol.iterator] = iterateTree;

        for (let node of newTree) {
          const nodeEntity = node.rules ? 'group' : 'rule';

          if (!this.checkNode(node, nodeEntity)) throw new Error;

          node.id = this.identityManager.getId(nodeEntity)
        }

        this.tree = newTree;

      } catch(error) {
        /* If provided initial tree turned out invalid, drop it and create a new one */

        newTree = this.createNode('group');
        newTree[Symbol.iterator] = iterateTree;
        this.tree = newTree;
      }

      function* iterateTree() {
        const stack = [this];

        while (stack.length !== 0) {
          let currentNode = stack.shift();

          if (currentNode.rules) {
            for (let i = 0; i < currentNode.rules.length; i++) {
              stack.push(currentNode.rules[i]);
            }
            yield currentNode;
          }
          else {
            yield currentNode;
          }
        }
      }
    }

    modifyNode(nodeId, field, newValue) {
      for (let node of this.tree) {
        if (node.id === nodeId && field in node) {
          node[field] = newValue;
          break;
        }
      }
    }

    removeNode(nodeId) {
      for (let node of this.tree) {
        const rules = node.rules;
        const index = rules ? rules.findIndex((item) => item.id === nodeId) : -1;

        if (index !== -1) {
          rules.splice(index, 1);
          break;
        }
      }
    }

    withUpdate(func) {
      return (...params) => {
        func(...params);
        this.updateCallback(this.copyTree(this.tree));
      }
    }
  }

  class IdentityManager {
    constructor(groupMark = 'g', ruleMark = 'r', initialValues = 0) {
      this.groupMark = groupMark;
      this.ruleMark = ruleMark;
      this.groupCount = initialValues;
      this.ruleCount = initialValues;

      this.getId = this.getId.bind(this);
    }

    getId(entity) {
      let mark = (entity === 'group') ? this.groupMark : this.ruleMark;
      let num = (entity === 'group') ? this.groupCount++ : this.ruleCount++;

      return `${mark}-${num}`;
    }
  }

  return function (initialTree, updateCallback) {
    const queryBuilder = new QueryBuilder(initialTree, updateCallback);

    return Object.freeze({
      addNode: queryBuilder.addNode,
      modifyNode: queryBuilder.modifyNode,
      removeNode: queryBuilder.removeNode,
    });
  }
})();

const possibleFields = [
  'twitter',
  'facebook',
  'name',
  'address',
  'phone',
];

const possibleOperators = [
  '=',
  '<',
  '>',
  '!=',
];

const possibleCombinators = [
  'AND',
  'OR',
];


// React app


class App extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      query: null,
    };

    this.handleQueryBuilderUpdate = this.handleQueryBuilderUpdate.bind(this);
    this.handleAddItem = this.handleAddItem.bind(this);
    this.handleRemoveItem = this.handleRemoveItem.bind(this);
    this.handleModifyItem = this.handleModifyItem.bind(this);
  }

  componentDidMount() {
    this.queryBuilder = QueryBuilderFactory(
      {
        combinator: 'OR',
        rules: [
          { field: 'twitter', value: 'twitter twitter', operator: '>' }
        ]
      },
      this.handleQueryBuilderUpdate
    );
  }

  handleQueryBuilderUpdate(newState) {
    this.setState({
      query: newState,
    });
  };

  handleAddItem(parentId, entity) {
    this.queryBuilder.addNode(parentId, entity);
  };

  handleRemoveItem(nodeId) {
    this.queryBuilder.removeNode(nodeId);
  };

  handleModifyItem(nodeId, field, event) {
    this.queryBuilder.modifyNode(nodeId, field, event.target.value);
  };

  render() {
    const { query } = this.state;

    return query ?
      React.createElement('div', null,
        React.createElement(QueryItem, {
          isRoot: true,
          item: query,
          handleAddItem: this.handleAddItem,
          handleRemoveItem: this.handleRemoveItem,
          handleModifyItem: this.handleModifyItem,
          },
          null
        )

  ) : null
  }
}

const GroupView = ({ item, isRoot, handleAddItem, handleRemoveItem, handleModifyItem }) => (
  React.createElement('div', { className: 'group-view' },
    React.createElement('div', { className: 'group-controls'  },
      React.createElement('select', {
          value: item.combinator,
          onChange: (event) => handleModifyItem(item.id, 'combinator', event),
        },
        React.createElement('option', null , null),
        possibleCombinators.map((item) => (
          React.createElement('option', {
              key: item,
              value: item,
            },
            item)
        ))
      ),
      React.createElement('button', {
          onClick: () => handleAddItem(item.id, 'rule'),
        },
        '+Rule'
      ),
      React.createElement('button', {
          onClick: () => handleAddItem(item.id, 'group'),
        },
        '+Group'
      ),
      isRoot ?
        null :
        React.createElement('button', {
            onClick: () => handleRemoveItem(item.id),
          },
          '\u2715'
        )
    ),
    item.rules.map((subitem) => (
      React.createElement(QueryItem, {
          item: subitem,
          key: subitem.id,
          handleAddItem: handleAddItem,
          handleRemoveItem: handleRemoveItem,
          handleModifyItem: handleModifyItem,
        },
        null
      )
    ))
  )
);

const RuleView = ({ item, handleRemoveItem, handleModifyItem }) => (
  React.createElement('div', null,
    React.createElement('select', {
        value: item.field,
        onChange: (event) => handleModifyItem(item.id, 'field', event),
      },
      React.createElement('option', null , null),
      possibleFields.map((item, index) => (
        React.createElement('option', {
            key: item,
            value: item,
            selected: index === 0,
            defaultSelected: index === 0
          },
          item
        )
      ))
    ),
    React.createElement('select', {
        value: item.operator,
        onChange: (event) => handleModifyItem(item.id, 'operator', event),
      },
      React.createElement('option', null , null),
      possibleOperators.map((item) => (
        React.createElement('option', {
            key: item,
            value: item,
          },
          item
        )
      ))
    ),
    React.createElement('input', {
        value: item.value,
        onChange: (event) => handleModifyItem(item.id, 'value', event),
      }
    ),
    React.createElement('button', {
        onClick: () => handleRemoveItem(item.id),
      },
      '\u2715'
    )
  )
);

const QueryItem = ({ item, isRoot, ...rest }) => {
  const isGroup = !!item.rules;

  return (
    React.createElement('div', {
        className: 'query-item',
      },
      isGroup ?
        React.createElement(GroupView, {
            ...rest,
            item,
            isRoot: isRoot,
          },
          null
        )
        : React.createElement(RuleView, {
            ...rest,
            item,
          },
          null
        )
    )
  );
};

ReactDOM.render(
  React.createElement(App, null, null),
  document.getElementById('app-react')
);


// Vue app


Vue.component('query-item', {
  name: 'QueryItem',
  template: '#query-item-template',
  props: {
    item: Object,
    isRoot: {
      type: Boolean,
      default: false,
    }
  },
  data() {
    return {
      possibleFields,
      possibleOperators,
      possibleCombinators,
    }
  },
  methods: {
    handleAddItem(id, entity) {
      this.$emit('item-added', id, entity);
    },
    handleModifyItem(id, field, event) {
      this.$emit('item-modified', id, field, event);
    },
    handleRemoveItem(id) {
      this.$emit('item-removed', id);
    },
  }
});

new Vue({
  el: '#app-vue',
  template: '#app-template',
  data() {
    return {
      query: null,
      queryBuilder: null,
    }
  },
  methods: {
    updateCallback(newState) {
      this.query = newState;
    },
    addNode(parentId, entity) {
      this.queryBuilder.addNode(parentId, entity);
    },
    modifyNode(nodeId, field, event) {
      this.queryBuilder.modifyNode(nodeId, field, event.target.value);
    },
    removeNode(nodeId) {
      this.queryBuilder.removeNode(nodeId);
    },
  },
  created() {
    this.queryBuilder = QueryBuilderFactory(null, this.updateCallback);
  }
});

