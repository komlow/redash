import { each, values, map, includes, first } from 'lodash';
import React from 'react';
import PropTypes from 'prop-types';
import Select from 'antd/lib/select';
import Modal from 'antd/lib/modal';
import { wrap as wrapDialog, DialogPropType } from '@/components/DialogWrapper';
import {
  MappingType,
  ParameterMappingListInput,
  editableMappingsToParameterMappings,
  synchronizeWidgetTitles,
} from '@/components/ParameterMappingInput';
import QuerySelector from '@/components/QuerySelector';

import { toastr } from '@/services/ng';
import { Widget } from '@/services/widget';
import { Query } from '@/services/query';

const { Option, OptGroup } = Select;

class AddWidgetDialog extends React.Component {
  static propTypes = {
    dashboard: PropTypes.object.isRequired, // eslint-disable-line react/forbid-prop-types
    dialog: DialogPropType.isRequired,
  };

  state = {
    saveInProgress: false,
    selectedQuery: null,
    selectedVis: null,
    parameterMappings: [],
  };

  selectQuery(queryId) {
    // Clear previously selected query (if any)
    this.setState({
      selectedQuery: null,
      selectedVis: null,
      parameterMappings: [],
    });

    if (queryId) {
      Query.get({ id: queryId }, (query) => {
        if (query) {
          const existingParamNames = map(
            this.props.dashboard.getParametersDefs(),
            param => param.name,
          );
          this.setState({
            selectedQuery: query,
            parameterMappings: map(query.getParametersDefs(), param => ({
              name: param.name,
              type: includes(existingParamNames, param.name)
                ? MappingType.DashboardMapToExisting : MappingType.DashboardAddNew,
              mapTo: param.name,
              value: param.normalizedValue,
              title: '',
              param,
            })),
          });
          if (query.visualizations.length) {
            this.setState({ selectedVis: query.visualizations[0] });
          }
        }
      });
    }
  }

  selectVisualization(query, visualizationId) {
    each(query.visualizations, (visualization) => {
      if (visualization.id === visualizationId) {
        this.setState({ selectedVis: visualization });
        return false;
      }
    });
  }

  saveWidget() {
    const dashboard = this.props.dashboard;

    this.setState({ saveInProgress: true });

    const widget = new Widget({
      visualization_id: this.state.selectedVis && this.state.selectedVis.id,
      dashboard_id: dashboard.id,
      options: {
        isHidden: false,
        position: {},
        parameterMappings: editableMappingsToParameterMappings(this.state.parameterMappings),
      },
      visualization: this.state.selectedVis,
      text: '',
    });

    const position = dashboard.calculateNewWidgetPosition(widget);
    widget.options.position.col = position.col;
    widget.options.position.row = position.row;

    const widgetsToSave = [
      widget,
      ...synchronizeWidgetTitles(widget.options.parameterMappings, dashboard.widgets),
    ];

    Promise.all(map(widgetsToSave, w => w.save()))
      .then(() => {
        dashboard.widgets.push(widget);
        this.props.dialog.close();
      })
      .catch(() => {
        toastr.error('Widget can not be added');
      })
      .finally(() => {
        this.setState({ saveInProgress: false });
      });
  }

  updateParamMappings(parameterMappings) {
    this.setState({ parameterMappings });
  }

  renderVisualizationInput() {
    let visualizationGroups = {};
    if (this.state.selectedQuery) {
      each(this.state.selectedQuery.visualizations, (vis) => {
        visualizationGroups[vis.type] = visualizationGroups[vis.type] || [];
        visualizationGroups[vis.type].push(vis);
      });
    }
    visualizationGroups = values(visualizationGroups);
    return (
      <div>
        <div className="form-group">
          <label htmlFor="choose-visualization">Choose Visualization</label>
          <Select
            id="choose-visualization"
            className="w-100"
            defaultValue={first(this.state.selectedQuery.visualizations).id}
            onChange={visualizationId => this.selectVisualization(this.state.selectedQuery, visualizationId)}
            dropdownClassName="ant-dropdown-in-bootstrap-modal"
          >
            {visualizationGroups.map(visualizations => (
              <OptGroup label={visualizations[0].type} key={visualizations[0].type}>
                {visualizations.map(visualization => (
                  <Option value={visualization.id} key={visualization.id}>{visualization.name}</Option>
                ))}
              </OptGroup>
            ))}
          </Select>
        </div>
      </div>
    );
  }

  render() {
    const existingParams = this.props.dashboard.getParametersDefs();
    const { dialog } = this.props;

    return (
      <Modal
        {...dialog.props}
        title="Add Widget"
        onOk={() => this.saveWidget()}
        okButtonProps={{
          loading: this.state.saveInProgress,
          disabled: !this.state.selectedQuery,
        }}
        okText="Add to Dashboard"
        width={700}
      >
        <QuerySelector onChange={id => this.selectQuery(id)} />
        {this.state.selectedQuery && this.renderVisualizationInput()}

        {
          (this.state.parameterMappings.length > 0) && [
            <label key="parameters-title" htmlFor="parameter-mappings">Parameters</label>,
            <ParameterMappingListInput
              key="parameters-list"
              id="parameter-mappings"
              mappings={this.state.parameterMappings}
              existingParams={existingParams}
              onChange={mappings => this.updateParamMappings(mappings)}
            />,
          ]
        }
      </Modal>
    );
  }
}

export default wrapDialog(AddWidgetDialog);
