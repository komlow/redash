import { includes, words, capitalize, clone, isNull } from 'lodash';
import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import Modal from 'antd/lib/modal';
import Form from 'antd/lib/form';
import Checkbox from 'antd/lib/checkbox';
import Select from 'antd/lib/select';
import Input from 'antd/lib/input';
import Divider from 'antd/lib/divider';
import { wrap as wrapDialog, DialogPropType } from '@/components/DialogWrapper';
import { Query } from '@/services/query';

const { Option } = Select;
const formItemProps = { labelCol: { span: 6 }, wrapperCol: { span: 16 } };

function useQuerySearch() {
  const [searchTerm, setSearchTerm] = useState(); // search term
  const [searchResults, setSearchResults] = useState([]); // search results

  useEffect(() => {
    if (!searchTerm || searchTerm.length < 3) {
      return;
    }

    Query.query({ q: searchTerm }, ({ results }) => {
      setSearchResults(results);
    });
  }, [searchTerm]); // search when term changes

  return [searchResults, setSearchResults, setSearchTerm];
}

function useParamSave(onConfirm, onClose) {
  const [saving, setSaving] = useState(false);

  const save = (param) => {
    setSaving(true);
    onConfirm(param)
      .then(() => {
        onClose(param);
      }).finally(() => {
        setSaving(false);
      });
  };

  return [saving, save];
}

function getDefaultTitle(text) {
  return capitalize(words(text).join(' ')); // humanize
}

function useNewName(existingParams) {
  const [name, setName] = useState('');
  const [feedback, setFeedback] = useState({ isError: false, text: null });

  useEffect(() => {
    const alreadyExists = includes(existingParams, name);
    if (alreadyExists) {
      setFeedback({ isError: true, helpText: 'Parameter with this name already exists' });
    } else if (!name) {
      setFeedback({ isError: false, helpText: 'Choose a keyword for this parameter' });
    } else {
      setFeedback({ isError: false, helpText: `This is what will be added to your query editor {{ ${name} }}` });
    }
  }, [name]);

  return [feedback, name, setName];
}

function EditParameterSettingsDialog(props) {
  const [param, setParam] = useState(clone(props.parameter));
  const [querySearchResults, setQuerySearchResults, setQuerySearchTerm] = useQuerySearch();
  const [newNameFeedback, newName, setNewName] = useNewName(props.existingParams);
  const [saving, save] = useParamSave(props.onConfirm, props.dialog.close);
  const isNew = !props.parameter.name;

  // get query name by id
  useEffect(() => {
    if (param.queryId) {
      Query.get({ id: props.parameter.queryId }, (query) => {
        setQuerySearchResults([query]);
      });
    }
  }, []);

  const onSaveClicked = () => {
    // update name and title
    if (isNew) {
      param.name = newName;
      if (!param.title) {
        param.title = getDefaultTitle(newName);
      }
      setParam(param);
    }

    save(param);
  };

  return (
    <Modal
      {...props.dialog.props}
      title={isNew ? 'Add Parameter' : newName}
      onOk={onSaveClicked}
      okText={isNew ? 'Add Parameter' : 'Save'}
      okButtonProps={{
        loading: saving,
        disabled: isNew && (newNameFeedback.isError || !newName) || param.title === '',
      }}
    >
      <Form layout="horizontal">
        {isNew && (
          <Form.Item
            required
            label="Keyword"
            help={newNameFeedback.text}
            validateStatus={newNameFeedback.isError ? 'error' : ''}
            {...formItemProps}
          >
            <Input onChange={e => setNewName(e.target.value)} />
          </Form.Item>
        )}
        <Form.Item label="Title" {...formItemProps}>
          <Input
            value={isNull(param.title) ? getDefaultTitle(newName) : param.title}
            onChange={e => setParam({ ...param, title: e.target.value })}
          />
        </Form.Item>
        <Form.Item label="Type" {...formItemProps}>
          <Select value={param.type} onChange={type => setParam({ ...param, type })}>
            <Option value="text">Text</Option>
            <Option value="number">Number</Option>
            <Option value="enum">Dropdown List</Option>
            <Option value="query">Query Based Dropdown List</Option>
            <Option disabled key="dv1">
              <Divider className="select-option-divider" />
            </Option>
            <Option value="date">Date</Option>
            <Option value="datetime-local">Date and Time</Option>
            <Option value="datetime-with-seconds">Date and Time (with seconds)</Option>
            <Option disabled key="dv2">
              <Divider className="select-option-divider" />
            </Option>
            <Option value="date-range">Date Range</Option>
            <Option value="datetime-range">Date and Time Range</Option>
            <Option value="datetime-range-with-seconds">Date and Time Range (with seconds)</Option>
          </Select>
        </Form.Item>
        {includes(['date', 'datetime-local', 'datetime-with-seconds'], param.type) && (
          <Form.Item label=" " colon={false} {...formItemProps}>
            <Checkbox
              defaultChecked={param.useCurrentDateTime}
              onChange={e => setParam({ ...param, useCurrentDateTime: e.target.checked })}
            >
              Default to Today/Now if no other value is set
            </Checkbox>
          </Form.Item>
        )}
        {param.type === 'enum' && (
          <Form.Item label="Values" help="Dropdown list values (newline delimeted)" {...formItemProps}>
            <Input.TextArea
              rows={3}
              value={param.enumOptions}
              onChange={e => setParam({ ...param, enumOptions: e.target.value })}
            />
          </Form.Item>
        )}
        {param.type === 'query' && (
          <Form.Item label="Query" help="Select query to load dropdown values from" {...formItemProps}>
            <Select
              showSearch
              showArrow={false}
              value={param.queryId}
              defaultActiveFirstOption={false}
              filterOption={false}
              onSearch={setQuerySearchTerm}
              onChange={queryId => setParam({ ...param, queryId })}
              notFoundContent={null}
              placeholder="Search a query by name"
            >
              {querySearchResults.map(q => <Option value={q.id} key={q.id}>{q.name}</Option>)}
            </Select>
          </Form.Item>
        )}
      </Form>
    </Modal>
  );
}

EditParameterSettingsDialog.propTypes = {
  parameter: PropTypes.object.isRequired, // eslint-disable-line react/forbid-prop-types
  dialog: DialogPropType.isRequired,
  onConfirm: PropTypes.func,
  existingParams: PropTypes.arrayOf(PropTypes.string),
};

EditParameterSettingsDialog.defaultProps = {
  existingParams: [],
  onConfirm: () => Promise.resolve(),
};

export default wrapDialog(EditParameterSettingsDialog);
