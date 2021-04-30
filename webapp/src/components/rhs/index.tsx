// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License for license information.

import {connect} from 'react-redux';

import {getCurrentChannelId} from 'mattermost-redux/selectors/entities/common';
import {GlobalState} from 'mattermost-redux/types/store';

import RHS from './rhs';

function mapStateToProps(state: GlobalState) {
    return {
        currentChannelID: getCurrentChannelId(state),
    };
}

export default connect(mapStateToProps)(RHS);
