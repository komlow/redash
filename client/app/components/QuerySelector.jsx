import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import cx from 'classnames';
import Input from 'antd/lib/input';
import { Query } from '@/services/query';
import { QueryTagsControl } from '@/components/tags-control/TagsControl';

const SEARCH_DEBOUNCE_DURATION = 200;

function fetchRecent() {
  return Query.recent().$promise
    .then((results) => {
      const filteredResults = results.filter(item => !item.is_draft); // TODO: filter at the fetch level
      return Promise.resolve(filteredResults);
    });
}

function search(q) {
  return new Promise((resolve) => {
    Query.query({ q }, ({ results }) => {
      resolve(results);
    });
  });
}

export default function QuerySelector(props) {
  const [searchTerm, setSearchTerm] = useState();
  const [searching, setSearching] = useState();
  const [searchResults, setSearchResults] = useState([]);
  const [selectedQuery, setSelectedQuery] = useState();

  // on search term changed, debounced
  useEffect(() => {
    setSearching(true);
    const debounce = setTimeout(() => {
      const promise = searchTerm ? () => search(searchTerm) : fetchRecent;
      promise()
        .then(setSearchResults)
        .finally(() => {
          setSearching(false);
        });
    }, SEARCH_DEBOUNCE_DURATION);

    return () => {
      clearTimeout(debounce);
    };
  }, [searchTerm]);

  // on query selected
  useEffect(() => {
    const id = selectedQuery ? selectedQuery.id : null;
    props.onChange(id);
  }, [selectedQuery]);

  function renderResults() {
    if (searchTerm && !searchResults.length) {
      return <div className="text-muted">No results matching search term.</div>;
    }

    return (
      <div className="list-group">
        {searchResults.map(q => (
          <a
            href="javascript:void(0)"
            className={cx('list-group-item', { inactive: q.is_draft })}
            key={q.id}
            onClick={() => setSelectedQuery(q)}
          >
            {q.name}
            {' '}
            <QueryTagsControl isDraft={q.is_draft} tags={q.tags} className="inline-tags-control" />
          </a>
        ))}
      </div>
    );
  }

  return (
    <React.Fragment>
      {selectedQuery ? (
        <Input
          value={selectedQuery.name}
          suffix={<i className="fa fa-times" onClick={() => setSelectedQuery(null)} />}
          readOnly
        />
      ) : (
        <Input
          placeholder="Search a query by name"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          suffix={<i className={cx('fa fa-spinner fa-pulse', { hidden: !searching })} />}
        />
      )}
      <div className="scrollbox" style={{ maxHeight: '50vh', marginTop: 15 }}>
        {!selectedQuery && renderResults()}
      </div>
    </React.Fragment>
  );
}

QuerySelector.propTypes = {
  onChange: PropTypes.func.isRequired,
};
